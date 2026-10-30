// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import type {
  TMDBSearchResponse,
  TMDBSearchResult,
  WatchStatus,
} from "@/lib/tmdb/types";

const state = vi.hoisted(() => ({
  statuses: new Map<string, WatchStatus>(),
  statusesLoading: false,
  pendingStatuses: new Set<string>(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ prefetch: state.prefetch }),
}));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props} />;
  },
}));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => ({ user: { id: "search-user" } }),
}));
vi.mock("@/components/media/tmdb-image", () => ({
  PosterImage: () => <span aria-hidden="true" />,
}));
vi.mock("./use-media-statuses", () => ({
  useMediaStatuses: () => ({
    getStatus: (id: number, type: string) =>
      state.statuses.get(`${type}:${id}`),
    isLoading: state.statusesLoading || state.pendingStatuses.size > 0,
    isStatusLoading: (id: number, type: string) =>
      state.statusesLoading || state.pendingStatuses.has(`${type}:${id}`),
  }),
}));
import SearchPage from "@/app/(authenticated)/search/page";
import { tmdbClient } from "@/lib/tmdb/client-api";

const movie = {
  id: 1,
  media_type: "movie",
  title: "Dune",
  original_title: "Dune",
  release_date: "2021-10-22",
  overview: "A plot that should not appear in compact results.",
  poster_path: null,
} as TMDBSearchResult;
const series = {
  id: 2,
  media_type: "tv",
  name: "Severance",
  original_name: "Severance",
  first_air_date: "2022-02-18",
  overview: "A second plot.",
  poster_path: null,
} as TMDBSearchResult;
function page(
  results: TMDBSearchResult[],
  number = 1,
  total = 1,
): TMDBSearchResponse {
  return {
    results,
    page: number,
    total_pages: total,
    total_results: results.length,
  };
}

const cleanups: (() => Promise<void>)[] = [];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.statuses.clear();
  state.statusesLoading = false;
  state.pendingStatuses.clear();
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(
  path = "/search?q=dune",
  mutate: (name: string, args: unknown) => Promise<void> = async () => {},
) {
  window.history.replaceState(null, "", path);
  const client = {
    mutation: vi.fn((ref, args) => mutate(getFunctionName(ref), args)),
  };
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () =>
    root.render(
      <ConvexProvider client={client as unknown as ConvexReactClient}>
        <QueryClientProvider client={cache}>
          <SearchPage />
        </QueryClientProvider>
      </ConvexProvider>,
    );
  const replace = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
    replace(...args);
    render();
  });
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  cleanups.push(async () => {
    await act(() => root.unmount());
    cache.clear();
    container.remove();
  });
  await act(render);
  await settle();
  const button = (label: string) => {
    const found = [...container.querySelectorAll("button")].find(
      (node) =>
        (node.getAttribute("aria-label") ?? node.textContent?.trim()) === label,
    );
    expect(found, label).toBeDefined();
    return found!;
  };
  return {
    container,
    client,
    button,
    settle,
    render: () => act(render),
    click: async (label: string) => {
      await act(() => button(label).click());
      await settle();
    },
  };
}

test("people-only pages keep pagination reachable and later-page failures keep existing titles", async () => {
  let intersect: IntersectionObserverCallback | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  let failNext = true;
  const search = vi
    .spyOn(tmdbClient, "searchMulti")
    .mockImplementation(async (_q, number = 1) => {
      if (number === 1)
        return page(
          [{ id: 3, media_type: "person", name: "Person" } as TMDBSearchResult],
          1,
          3,
        );
      if (number === 2) return page([movie], 2, 3);
      if (failNext) throw new Error("offline");
      return page([movie, series], 3, 3);
    });
  const view = await mount();
  expect(view.container.textContent).not.toContain("No titles found");
  expect(view.button("Load more").disabled).toBe(false);
  await act(async () => {
    intersect!(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    intersect!(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  });
  await view.settle();
  expect(search.mock.calls.filter((call) => call[1] === 2)).toHaveLength(1);
  expect(
    view.container.querySelector('a[href="/movies/1"]')?.textContent,
  ).toContain("Dune");
  expect(view.container.textContent).not.toContain("A plot");
  await view.click("Load more");
  expect(view.container.querySelector('a[href="/movies/1"]')).not.toBeNull();
  expect(view.container.textContent).not.toContain("We couldn’t load results");
  expect(view.button("Retry loading more").disabled).toBe(false);
  failNext = false;
  await view.click("Retry loading more");
  expect(view.container.querySelectorAll('a[href="/movies/1"]')).toHaveLength(
    1,
  );
  expect(
    view.container.querySelector('a[href="/tv-series/2"]')?.textContent,
  ).toContain("Severance");
  expect(view.container.textContent).toContain("reached the end");
});

test("loading new result statuses keeps existing watchlist buttons and menus usable", async () => {
  const nextMovie = { ...movie, id: 3, title: "Dune: Part Two" } as TMDBSearchResult;
  vi.spyOn(tmdbClient, "searchMulti").mockImplementation(async (_q, number = 1) =>
    number === 1 ? page([movie, series], 1, 2) : page([nextMovie], 2, 2),
  );
  state.statuses.set("tv:2", "currently_watching");
  const view = await mount();
  const watchlist = view.button("Add to Watchlist: Dune");
  const movieMenu = view.button("Manage status for Dune");
  const seriesMenu = view.button("Manage status for Severance");

  state.pendingStatuses.add("movie:3");
  await view.click("Load more");
  expect(view.button("Add to Watchlist: Dune")).toBe(watchlist);
  expect(watchlist.disabled).toBe(false);
  expect(view.button("Manage status for Dune")).toBe(movieMenu);
  expect(movieMenu.disabled).toBe(false);
  expect(view.button("Manage status for Severance")).toBe(seriesMenu);
  expect(seriesMenu.disabled).toBe(false);
  expect(view.button("Manage status for Dune: Part Two").disabled).toBe(true);
  expect(view.container.textContent).toContain("Checking status…");
  expect(view.container.querySelector('[aria-label="Add to Watchlist: Dune: Part Two"]')).toBeNull();

  state.pendingStatuses.clear();
  await view.render();
  expect(view.button("Add to Watchlist: Dune: Part Two").disabled).toBe(false);
  expect(view.button("Manage status for Dune: Part Two").disabled).toBe(false);
  expect(view.container.textContent).not.toContain("Checking status…");
});

test("initial errors offer retry and media-scoped empty results can broaden the query", async () => {
  let failed = true;
  vi.spyOn(tmdbClient, "searchMovies").mockImplementation(async () => {
    if (failed) throw new Error("upstream implementation detail");
    return page([]);
  });
  const all = vi
    .spyOn(tmdbClient, "searchMulti")
    .mockResolvedValue(page([series]));
  const view = await mount(
    "/search?q=severance&mode=movie&source=library#results",
  );
  expect(view.container.textContent).toContain("We couldn’t load results");
  expect(view.container.textContent).not.toContain(
    "upstream implementation detail",
  );
  failed = false;
  await view.click("Retry search");
  expect(view.container.textContent).toContain("No movies found");
  await view.click("Search all titles");
  expect(all).toHaveBeenCalled();
  expect(window.location.search).toBe("?q=severance&source=library");
  expect(window.location.hash).toBe("#results");
  expect(view.button("All").getAttribute("aria-pressed")).toBe("true");
  expect(view.container.textContent).toContain("Severance");
});

test("quick saving waits for status, retries a failed save, and preserves known tracking states", async () => {
  vi.spyOn(tmdbClient, "searchMulti").mockResolvedValue(page([movie, series]));
  state.statusesLoading = true;
  state.statuses.set("tv:2", "currently_watching");
  let failSave = true;
  const view = await mount("/search?q=dune", async () => {
    if (failSave) throw new Error("offline");
  });
  expect(view.container.textContent).toContain("Checking status…");
  expect(
    view.container.querySelector('[aria-label="Add to Watchlist: Dune"]'),
  ).toBeNull();
  expect(view.container.textContent).toContain("Currently Watching");
  state.statusesLoading = false;
  await view.render();
  await view.click("Add to Watchlist: Dune");
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "Couldn’t save Dune",
  );
  failSave = false;
  await view.click("Add to Watchlist: Dune");
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  expect(
    view.container.querySelector('[aria-label="Add to Watchlist: Dune"]'),
  ).toBeNull();
  expect(
    view.container.querySelector('[aria-label="Add to Watchlist: Severance"]'),
  ).toBeNull();
  expect(view.client.mutation).toHaveBeenCalledTimes(2);
  expect(getFunctionName(view.client.mutation.mock.calls[0][0])).toBe(
    "movie:setMovieStatus",
  );
  expect(view.client.mutation.mock.calls[0][1]).toMatchObject({
    movieId: 1,
    status: "want_to_watch",
  });
});

test("TV quick saving shows pending feedback and uses the existing series status action", async () => {
  vi.spyOn(tmdbClient, "searchMulti").mockResolvedValue(page([series]));
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const view = await mount("/search?q=severance", () => pending);
  await view.click("Add to Watchlist: Severance");
  expect(view.button("Saving Severance to Watchlist").disabled).toBe(true);
  expect(view.container.textContent).toContain("Saving…");
  await act(async () => finish());
  expect(
    view.container.querySelector('[aria-label="Add to Watchlist: Severance"]'),
  ).toBeNull();
  expect(getFunctionName(view.client.mutation.mock.calls[0][0])).toBe(
    "tv:setSeriesStatus",
  );
  expect(view.client.mutation.mock.calls[0][1]).toEqual({
    tvSeriesId: 2,
    status: "want_to_watch",
  });
});
