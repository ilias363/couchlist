import { expect, test } from "vitest";
import { getFunctionName } from "convex/server";
import { api } from "../convex/_generated/api";

test("retry arguments create a new Convex transport subscription instead of reusing a cached failure", async () => {
  // Exercise the installed runtime, without compiling dependency source under
  // the app's older ES target. These declarations are shipped with that runtime.
  const { QueriesObserver } = await import(new URL("../node_modules/convex/dist/esm/react/queries_observer.js", import.meta.url).href) as typeof import("../node_modules/convex/dist/esm-types/react/queries_observer");
  const { LocalSyncState } = await import(new URL("../node_modules/convex/dist/esm/browser/sync/local_state.js", import.meta.url).href) as typeof import("../node_modules/convex/dist/esm-types/browser/sync/local_state");
  const sync = new LocalSyncState();
  let additions = 0;
  const observer = new QueriesObserver((query, args) => ({
    onUpdate: () => {
      const subscription = sync.subscribe(getFunctionName(query), args);
      if (subscription.modification) additions++;
      return () => { subscription.unsubscribe(); };
    },
    localQueryResult: () => { if (!args.retry) throw new Error("failed query"); return [1]; },
    localQueryLogs: () => undefined,
    journal: () => undefined,
  }));
  const args = { tvSeriesId: 1, seasonId: 10, episodeIds: [1], retry: 0 };
  observer.setQueries({ initial: { query: api.catchUp.watchedIds, args } });
  expect(observer.getLocalResults({ initial: { query: api.catchUp.watchedIds, args } }).initial).toBeInstanceOf(Error);
  expect(additions).toBe(1);
  // This was the original retry: a new local identifier does not restart it.
  observer.setQueries({ renamed: { query: api.catchUp.watchedIds, args } });
  expect(additions).toBe(1);
  const retried = { query: api.catchUp.watchedIds, args: { ...args, retry: 1 } };
  observer.setQueries({ retried });
  expect(additions).toBe(2);
  expect(observer.getLocalResults({ retried }).retried).toEqual([1]);
  observer.destroy();
});
