// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";
import { useCatchUpData } from "./use-catch-up-data";
import type { CatchUpSummary } from "../lib/catch-up";

const state = vi.hoisted(() => ({ rows: [] as CatchUpSummary[], watched: [11], verify: vi.fn().mockResolvedValue(true) }));
vi.mock("convex/react", async importOriginal => ({
  ...await importOriginal<typeof import("convex/react")>(),
  // Keep the installed useQueries, QueriesObserver and useSubscription real.
  // Only account/library transport and optional evidence writes are simulated.
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: () => ({ results: state.rows.map(row => ({ ...row, summariesReady: true })), status: "Exhausted", loadMore: vi.fn() }),
  useQuery: () => true,
  useMutation: () => state.verify,
}));

test("real Convex subscriptions settle with empty and changing catch-up requests", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const listeners = new Set<() => void>();
  const convex = { watchQuery: () => ({
    localQueryResult: () => state.watched,
    onUpdate: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    journal: () => undefined,
  }) } as unknown as ConvexReactClient;
  const metadata = { id: 101, season_number: 1, episode_count: 2, air_date: "2020-01-01", name: "Season 1" };
  const fetchMock = vi.fn(async (url: string) => Response.json(url.includes("/season/")
    ? { ...metadata, episodes: [11, 12].map(id => ({ id, air_date: "2020-01-01" })) }
    : { id: 1, name: "Returning", status: "Returning Series", poster_path: null, seasons: [metadata], last_episode_to_air: { season_number: 1, episode_number: 2, air_date: "2020-01-01" } }));
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const element = document.createElement("div"); const root = createRoot(element);
  let view!: ReturnType<typeof useCatchUpData>;
  function Probe() {
    const value = useCatchUpData();
    useEffect(() => { view = value; }, [value]);
    return <p>{value.totalUnwatchedEpisodes}</p>;
  }
  const render = () => act(async () => root.render(<ConvexProvider client={convex}><QueryClientProvider client={client}><Probe /></QueryClientProvider></ConvexProvider>));
  try {
    await render(); // An unstable empty request object already caused React #301.
    expect(view.isComplete).toBe(true); expect(listeners.size).toBe(0);
    state.rows = [{ tvSeriesId: 1, seasonWatchedCounts: { "101": 1 } }];
    await render();
    await vi.waitFor(async () => {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
      expect(view.isComplete).toBe(true); expect(view.totalUnwatchedEpisodes).toBe(1);
    });
    expect(listeners.size).toBe(1);
    await render(); await render();
    expect(view.totalUnwatchedEpisodes).toBe(1); expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { state.watched = []; for (const listener of listeners) listener(); });
    expect(view.totalUnwatchedEpisodes).toBe(2);
    state.rows = [];
    await render(); expect(view.isComplete).toBe(true); expect(listeners.size).toBe(0);
  } finally {
    await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals();
  }
});
