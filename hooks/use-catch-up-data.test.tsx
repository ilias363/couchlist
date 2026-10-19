// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCatchUpData } from "./use-catch-up-data";
import type { CatchUpSummary } from "../lib/catch-up";

const state = vi.hoisted(() => ({
  rows: [] as (CatchUpSummary & { summariesReady?: boolean })[],
  status: "Exhausted",
  watched: {} as Record<number, number[] | Error | undefined>,
  requests: [] as { episodeIds: number[]; tvSeriesId: number; seasonId: number }[],
  loadMore: vi.fn(),
  auth: { isAuthenticated: true, isLoading: false },
  ready: true as boolean | undefined,
  verify: vi.fn().mockResolvedValue(true),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => state.auth,
  useQuery: () => state.ready,
  useMutation: () => state.verify,
  usePaginatedQuery: () => ({ results: state.rows.map(row => ({ ...row, summariesReady: row.summariesReady ?? true })), status: state.status, loadMore: state.loadMore }),
  useQueries: (queries: Record<string, { args: { episodeIds: number[]; tvSeriesId: number; seasonId: number } }>) => {
    state.requests = Object.values(queries).map(q => q.args);
    return Object.fromEntries(Object.entries(queries).map(([key, { args }]) => [key,
      args.seasonId in state.watched ? state.watched[args.seasonId] : args.episodeIds.filter(id => id % 10 !== 0),
    ]));
  },
}));

const meta = (n: number, count = 10) => ({ id: 100 + n, season_number: n, episode_count: count, air_date: "2020-01-01", name: `Season ${n}` });
const counts = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(101 + i), 10]));
const proofs = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(101 + i), { episodeCount: 10, airDate: "2020-01-01", watchedCount: 10 }]));
const series = (id: number, seasons = Array.from({ length: 8 }, (_, i) => meta(i + 1))) => ({
  id, name: `Series ${id}`, poster_path: null, status: "Returning Series", seasons,
  last_episode_to_air: { season_number: 8, episode_number: 10, air_date: "2020-01-01" },
});
let client: QueryClient;
let root: Root;
let view: ReturnType<typeof useCatchUpData>;
let element: HTMLDivElement;
const fetchMock = vi.fn();
function Probe() {
  const value = useCatchUpData();
  useEffect(() => { view = value; }, [value]);
  return <p>{value.catchUpItems.map(i => i.name).join(",")}</p>;
}
async function render() { await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>)); }
async function until(assert: () => void) {
  const deadline = Date.now() + 5000;
  for (;;) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try { assert(); return; } catch (error) { if (Date.now() >= deadline) throw error; }
  }
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.rows = []; state.status = "Exhausted"; state.watched = {}; state.requests = []; state.loadMore.mockReset();
  state.auth = { isAuthenticated: true, isLoading: false };
  state.ready = true; state.verify.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  element = document.createElement("div"); document.body.append(element); root = createRoot(element);
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    const match = url.match(/\/tv\/(\d+)(?:\/season\/(\d+))?$/)!;
    if (!match[2]) return Response.json(series(Number(match[1])));
    const n = Number(match[2]);
    return Response.json({ ...meta(n), episodes: Array.from({ length: 10 }, (_, i) => ({ id: n * 10 + i + 1, air_date: "2020-01-01" })) });
  });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); element.remove(); vi.unstubAllGlobals(); });

test("25 verified unchanged returning shows: 25 cold details, zero seasons/ID reads, zero warm requests", async () => {
  state.rows = Array.from({ length: 25 }, (_, i) => ({ tvSeriesId: i + 1, seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs }));
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock).toHaveBeenCalledTimes(25);
  expect(fetchMock.mock.calls.every(([url]) => !url.includes("/season/"))).toBe(true);
  expect(state.requests).toEqual([]);
  await act(async () => root.unmount()); root = createRoot(element);
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock).toHaveBeenCalledTimes(25);
});

test("pending Convex authentication never declares an empty library caught up", async () => {
  state.auth = { isAuthenticated: false, isLoading: true };
  await render();
  expect(view.isLoading).toBe(true); expect(view.isComplete).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  state.auth = { isAuthenticated: true, isLoading: false };
  await render(); expect(view.isComplete).toBe(true);
});

test("imports suppress stale or reset summaries, cancel checks, and resume only with ready rows", async () => {
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: {}, summariesReady: false }];
  state.ready = false;
  await render();
  expect(view.isUpdating).toBe(true); expect(view.isComplete).toBe(false);
  expect(view.catchUpItems).toEqual([]); expect(fetchMock).not.toHaveBeenCalled();
  // Even if the separate readiness response arrives first, old pages cannot win.
  state.ready = true;
  await render(); expect(view.isComplete).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs }];
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  state.ready = false;
  await render(); expect(view.isComplete).toBe(false); expect(view.catchUpItems).toEqual([]);
});

test("first verification uses existing season caches, then persisted evidence skips history on a later cold cache", async () => {
  state.rows = Array.from({ length: 25 }, (_, i) => ({ tvSeriesId: i + 1, seasonWatchedCounts: counts }));
  for (let n = 1; n <= 8; n++) state.watched[100 + n] = Array.from({ length: 10 }, (_, i) => n * 10 + i + 1);
  await render(); await until(() => expect(state.verify).toHaveBeenCalledTimes(25));
  expect(fetchMock).toHaveBeenCalledTimes(225);
  expect(state.verify.mock.calls[0][0].seasons.flatMap((s: { episodeIds: number[] }) => s.episodeIds)).toHaveLength(80);
  // Simulate the authenticated proof mutation's reactive row, not a TMDB cache.
  state.rows = state.rows.map(row => ({ ...row, catchUpVerifiedSeasons: proofs }));
  await render(); await until(() => expect(state.requests).toEqual([]));
  await act(async () => root.unmount()); root = createRoot(element);
  client.clear(); fetchMock.mockClear();
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock).toHaveBeenCalledTimes(25); expect(state.requests).toEqual([]);
});

test("old gap and new episode fetch only candidate seasons, preserve completed history in totals", async () => {
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: { ...counts, "101": 9 }, catchUpVerifiedSeasons: proofs }];
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/tmdb/tv/1", "/api/tmdb/tv/1/season/1"]);
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0].episodeIds).toHaveLength(10);
  expect(view.catchUpItems[0]).toMatchObject({ totalEpisodes: 80, watchedEpisodes: 79, unwatchedEpisodes: 1 });
  // A count revision arrives after metadata expires. Only the changed season is checked.
  fetchMock.mockImplementation(async () => Response.json({ ...meta(1, 11), episodes: Array.from({ length: 11 }, (_, i) => ({ id: 11 + i, air_date: "2020-01-01" })) }));
  await act(async () => { client.setQueryData(["tmdb", "tv", 1], series(1, [meta(1, 11), ...series(1).seasons.slice(1)])); });
  await until(() => { expect(view.isComplete).toBe(true); expect(view.catchUpItems[0].totalEpisodes).toBe(81); });
  expect(fetchMock).toHaveBeenCalledTimes(3); // Fresh metadata invalidates the mismatching shared season entry.
});

test("completed shows render before a slow request; pagination totals are final only after exhaustion", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation(async (url: string) => url.endsWith("/2") ? new Promise<Response>(resolve => { finish = resolve; }) : Response.json(series(1, [meta(9, 1)])));
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: {} }, { tvSeriesId: 2, seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs }];
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/2")) return new Promise<Response>(resolve => { finish = resolve; });
    if (url.includes("/season/")) return Response.json({ ...meta(9, 1), episodes: [{ id: 91, air_date: "2020-01-01" }] });
    return Response.json(series(1, [meta(9, 1)]));
  });
  state.status = "CanLoadMore";
  await render(); await until(() => expect(view.catchUpItems).toHaveLength(1));
  expect(element.textContent).toContain("Series 1"); expect(view.isLoading).toBe(true); expect(view.isComplete).toBe(false);
  await act(async () => finish(Response.json(series(2))));
  await until(() => expect(view.isLoading).toBe(false));
  expect(view.isComplete).toBe(false); view.loadMore(); expect(state.loadMore).toHaveBeenCalledWith(25);
  state.rows = [...state.rows, { tvSeriesId: 3, seasonWatchedCounts: {} }]; state.status = "Exhausted";
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(view.totalUpToDate).toBe(3); expect(view.totalUnwatchedEpisodes).toBe(2);
});

test("upcoming seasons use metadata alone, while legacy large seasons compare IDs in bounded chunks", async () => {
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs }];
  fetchMock.mockImplementation(async () => Response.json(series(1, [meta(1), { ...meta(9), air_date: "2999-01-01" }])));
  await render(); await until(() => expect(view.isComplete).toBe(true));
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(state.requests).toEqual([]);
  expect(view.catchUpItems[0]).toMatchObject({ totalEpisodes: 10, watchedEpisodes: 10, unwatchedEpisodes: 0 });
  expect(view.totalUpcoming).toBe(1);
  state.rows = [{ tvSeriesId: 2 }]; // No stored summary: no migration required.
  fetchMock.mockImplementation(async (url: string) => Response.json(url.includes("/season/")
    ? { ...meta(1, 210), episodes: Array.from({ length: 210 }, (_, i) => ({ id: i + 1, air_date: "2020-01-01" })) }
    : series(2, [meta(1, 210)])));
  await render(); await until(() => expect(view.totalUnwatchedEpisodes).toBe(21));
  expect(state.requests.map(r => r.episodeIds.length)).toEqual([100, 100, 10]);
  expect(view.isComplete).toBe(true);
});

test("failed season/ID checks remain incomplete and can retry without hiding successful shows", async () => {
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: { ...counts, "101": 9 }, catchUpVerifiedSeasons: proofs }];
  state.watched[101] = new Error("failed");
  await render(); await until(() => expect(view.failedShows).toBe(1));
  expect(view.isLoading).toBe(false); expect(view.isComplete).toBe(false); expect(view.catchUpItems).toEqual([]);
  state.watched[101] = [11];
  await act(async () => view.retry());
  await until(() => expect(view.isComplete).toBe(true));
  expect(view.totalUnwatchedEpisodes).toBe(9);
  expect(state.requests[0]).toMatchObject({ retry: 1 });
});

test("TMDB failures stop loading, keep totals partial and retry successfully", async () => {
  state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs }];
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  await render();
  await act(async () => { await vi.waitFor(() => expect(view.failedShows).toBe(1), { timeout: 5000 }); });
  expect(view.isLoading).toBe(false); expect(view.isComplete).toBe(false);
  fetchMock.mockImplementation(async () => Response.json(series(1)));
  await act(async () => view.retry());
  await until(() => expect(view.isComplete).toBe(true));
});

test("unmount cancels active and queued TMDB work", async () => {
  const signals: AbortSignal[] = [];
  fetchMock.mockImplementation((_url: string, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    signals.push(signal); signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  state.rows = Array.from({ length: 25 }, (_, i) => ({ tvSeriesId: i + 1, seasonWatchedCounts: counts }));
  await render(); await until(() => expect(signals).toHaveLength(6));
  await act(async () => root.unmount()); root = createRoot(element);
  expect(signals.every(s => s.aborted)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
