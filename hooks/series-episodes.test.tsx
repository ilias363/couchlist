// @vitest-environment happy-dom
import { act, useSyncExternalStore, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BaseTMDBSeason } from "@/lib/tmdb/types";

const state = vi.hoisted(() => ({
  seriesStatus: undefined as { seasonWatchedCounts?: Record<string, number> } | null | undefined,
  statuses: {} as Record<number, { episodeId: number; isWatched: boolean; watchedDate?: number }[] | undefined>,
  queriedSeasons: new Set<number>(),
  mutate: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ tmdbId: "1" }),
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(
    callback => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); },
    () => window.location.search,
  )),
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({}),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: { seasonId: number } | "skip") => {
    if (getFunctionName(ref) === "tv:getSeriesStatus") return state.seriesStatus;
    if (args === "skip") return undefined;
    state.queriedSeasons.add(args.seasonId);
    return args.seasonId in state.statuses ? state.statuses[args.seasonId] : [];
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => (args: unknown) => state.mutate(getFunctionName(ref), args),
}));
vi.mock("@/components/tv-details/hero-section", () => ({ TvHeroSection: () => <h1>Test series</h1> }));
vi.mock("@/components/tv-details/details-grid", () => ({ TvDetailsGrid: () => <p>Series facts</p> }));
vi.mock("@/components/details-shared/cast-section", () => ({ CastSection: () => <p>Cast</p> }));
vi.mock("@/components/media/media-carousel", () => ({ MediaCarousel: () => null }));
vi.mock("@/components/media/tmdb-image", () => ({ StillImage: () => null, ProfileImage: () => null }));
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmButton: ({ children, onConfirm, disabled }: { children: ReactNode; onConfirm: () => void; disabled?: boolean }) =>
    <button disabled={disabled} onClick={onConfirm}>{children}</button>,
}));
vi.mock("@/components/media/watched-date-dialog", () => ({
  WatchedDateDialog: ({ open, onConfirm }: { open: boolean; onConfirm: (ms: number) => void }) =>
    open ? <button onClick={() => onConfirm(123)}>Confirm watch date</button> : null,
}));
import TvSeriesDetailsPage from "../app/(authenticated)/tv-series/[tmdbId]/page";
import SeasonDetailsPage from "../app/(authenticated)/tv-series/[tmdbId]/season/[seasonNumber]/page";

const seasonMeta = (n: number): BaseTMDBSeason => ({
  id: 100 + n, season_number: n, name: n === 0 ? "Specials" : `Season ${n}`,
  air_date: "2020-01-01", episode_count: 2, overview: `Overview ${n}`, poster_path: null, vote_average: 0,
});
let seasons: BaseTMDBSeason[];
let client: QueryClient;
let root: Root;
let element: HTMLDivElement;
const fetchMock = vi.fn();
async function render() {
  await act(async () => root.render(<QueryClientProvider client={client}><TvSeriesDetailsPage /></QueryClientProvider>));
}
async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assertion();
  });
}
function button(text: string) {
  const result = [...document.querySelectorAll("button")].find(button => button.textContent?.includes(text));
  expect(result, `Button containing ${text}`).toBeDefined();
  return result!;
}
async function openSeasons() {
  await act(async () => element.querySelector('[aria-label^="Select season"]')!.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }),
  ));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/tv-series/1");
  const push = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((data, title, url) => {
    push(data, title, url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  state.seriesStatus = { seasonWatchedCounts: { 101: 2, 102: 1 } };
  state.statuses = {}; state.queriedSeasons.clear(); state.mutate.mockReset().mockResolvedValue(null);
  seasons = [seasonMeta(1), seasonMeta(2), seasonMeta(3), seasonMeta(0)];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 600_000, gcTime: Infinity } } });
  element = document.createElement("div"); document.body.append(element); root = createRoot(element);
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    const match = url.match(/\/season\/(\d+)$/);
    if (!match) return Response.json({ id: 1, seasons, recommendations: { results: [] }, similar: { results: [] } });
    const n = Number(match[1]);
    return Response.json({ ...seasonMeta(n), episodes: [1, 2].map(i => ({
      id: n * 10 + i, name: `Episode ${n}-${i}`, episode_number: i, season_number: n, runtime: 45,
      air_date: "2020-01-01", still_path: null, overview: "", crew: [], guest_stars: [],
    })) });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); element.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

test("waits for progress, fetches only the first unfinished season, and keeps it selected after completion", async () => {
  state.seriesStatus = undefined;
  await render();
  await until(() => expect(element.textContent).toContain("Series facts"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  state.seriesStatus = { seasonWatchedCounts: { 101: 2, 102: 1 } };
  await render(); await until(() => expect(element.textContent).toContain("Episode 2-1"));
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/tmdb/tv/1?append_to_response=external_ids,recommendations,similar,credits", "/api/tmdb/tv/1/season/2",
  ]);
  expect([...state.queriedSeasons]).toEqual([102]);
  expect(element.textContent!.indexOf("Episode 2-1")).toBeLessThan(element.textContent!.indexOf("Series facts"));
  state.seriesStatus = { seasonWatchedCounts: { 101: 2, 102: 2 } };
  await render();
  expect(element.textContent).toContain("Episode 2-1");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("season selection preserves query params, updates the URL, and reuses cached details on Back", async () => {
  window.history.replaceState(null, "", "/tv-series/1?season=3&source=library");
  await render(); await until(() => expect(element.textContent).toContain("Episode 3-1"));
  await openSeasons();
  expect(document.body.textContent).toContain("2/2 watched");
  expect(document.body.textContent).toContain("1/2 watched");
  const option = [...document.querySelectorAll('[role="menuitemradio"]')].find(option => option.textContent?.startsWith("Season 2"))!;
  await act(async () => (option as HTMLElement).click());
  await until(() => expect(element.textContent).toContain("Episode 2-1"));
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/tv-series/1?season=2&source=library#episodes");
  await act(async () => window.history.back());
  await until(() => expect(element.textContent).toContain("Episode 3-1"));
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect([...state.queriedSeasons]).toEqual([103, 102]);
});

test.each(["-1", "999", "NaN", "1.5"])("invalid season %s falls back without fetching the invalid season", async query => {
  window.history.replaceState(null, "", `/tv-series/1?season=${query}`);
  await render(); await until(() => expect(element.textContent).toContain("Episode 2-1"));
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/tmdb/tv/1/season/2");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a completed series opens its last aired season and leaves future seasons unloaded", async () => {
  state.seriesStatus = { seasonWatchedCounts: { 101: 2, 102: 2 } };
  seasons[2].air_date = "2999-01-01";
  await render(); await until(() => expect(element.textContent).toContain("Episode 2-1"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("new shows start at season one and explicit specials links remain supported", async () => {
  state.seriesStatus = null;
  await render(); await until(() => expect(element.textContent).toContain("Episode 1-1"));
  await act(async () => window.history.pushState(null, "", "/tv-series/1?season=0"));
  await until(() => expect(element.textContent).toContain("Episode 0-1"));
  expect([...state.queriedSeasons]).toEqual([101, 100]);
});

test("season loading stays local, retries failures, and waits for watch statuses", async () => {
  const goodFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url: string) => url.includes("/season/") ? Promise.resolve(new Response(null, { status: 503 })) : goodFetch(url));
  await render(); await until(() => expect(element.textContent).toContain("Could not load this season"));
  expect(element.textContent).toContain("Series facts");
  state.statuses[102] = undefined;
  fetchMock.mockImplementation(goodFetch);
  await act(async () => button("Retry season").click());
  await until(() => expect(element.querySelector('[aria-label="Loading season episodes"]')).not.toBeNull());
  expect(element.textContent).not.toContain("0 of 2 watched");
  state.statuses[102] = [{ episodeId: 21, isWatched: true, watchedDate: 123 }];
  await render(); await until(() => expect(element.textContent).toContain("1 of 2 watched"));
});

test("episode and season updates keep IDs and watch dates scoped to the selected season and show errors", async () => {
  await render(); await until(() => expect(element.textContent).toContain("Episode 2-1"));
  await act(async () => element.querySelector<HTMLButtonElement>('#episode-21 button')!.click());
  await act(async () => button("Confirm watch date").click());
  expect(state.mutate).toHaveBeenLastCalledWith("tv:toggleEpisodeWatched", {
    tvSeriesId: 1, seasonId: 102, episodeId: 21, runtime: 45, isWatched: true, watchedAt: 123,
  });
  state.statuses[102] = [{ episodeId: 21, isWatched: true, watchedDate: 123 }];
  await render();
  await act(async () => button("Mark season watched").click());
  expect(state.mutate).toHaveBeenLastCalledWith("tv:bulkToggleSeasonEpisodes", {
    tvSeriesId: 1, seasonId: 102, episodesInfo: [{ episodeId: 21, runtime: 45 }, { episodeId: 22, runtime: 45 }], isWatched: true,
  });
  state.mutate.mockRejectedValueOnce(new Error("offline"));
  await act(async () => button("Unwatch season").click());
  expect(element.querySelector('[role="alert"]')?.textContent).toBe("offline");
  await act(async () => button("Unwatch season").click());
  expect(element.querySelector('[role="alert"]')).toBeNull();
  expect(state.mutate).toHaveBeenLastCalledWith("tv:bulkToggleSeasonEpisodes", expect.objectContaining({ seasonId: 102, isWatched: false }));
});

test("series without seasons keep the rest of the page usable without season requests", async () => {
  seasons = [];
  await render(); await until(() => expect(element.textContent).toContain("Series facts"));
  expect(element.textContent).not.toContain("Seasons & episodes");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(["2", "0"])("legacy season %s links redirect to the matching embedded season", async seasonNumber => {
  await expect(SeasonDetailsPage({ params: Promise.resolve({ tmdbId: "1", seasonNumber }), searchParams: Promise.resolve({}) }))
    .rejects.toThrow(`Redirect: /tv-series/1?season=${seasonNumber}#episodes`);
});

test("legacy redirects preserve unrelated query parameters and override season from the path", async () => {
  await expect(SeasonDetailsPage({
    params: Promise.resolve({ tmdbId: "1", seasonNumber: "2" }),
    searchParams: Promise.resolve({ source: "library", tag: ["a", "b"], empty: "", omitted: undefined, season: ["3", "4"] }),
  })).rejects.toThrow("Redirect: /tv-series/1?source=library&tag=a&tag=b&empty=&season=2#episodes");
});
