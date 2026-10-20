import { afterEach, expect, test } from "bun:test";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { ConvexProvider } from "convex/react";
import { getFunctionName } from "convex/server";
import { useTvSeriesStatus } from "../hooks/use-tv-status";

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function mountStatus(client) {
  const window = new Window({ url: "http://localhost:3000" });
  const globals = {
    window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Node: window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(window.document.createElement("div"));
  cleanups.push(async () => {
    await act(() => root.unmount());
    await window.happyDOM.abort();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  let current;
  function Probe() {
    const value = useTvSeriesStatus(1);
    useEffect(() => { current = value; });
    return null;
  }
  await act(() => root.render(<ConvexProvider client={client}><Probe /></ConvexProvider>));
  return { get current() { return current; } };
}

for (const failure of ["second batch", "status update"]) {
  test(`whole-series confirmation retries all episodes after a failed ${failure}`, async () => {
    const bulkStarts = [];
    const committed = new Set();
    let failOnce = true;
    let seriesStatus;
    const client = {
      async mutation(ref, args) {
        const name = getFunctionName(ref);
        if (name === "tv:bulkToggleSeasonEpisodes") {
          const first = args.episodesInfo[0].episodeId;
          bulkStarts.push(first);
          expect(args.episodesInfo.length).toBeLessThanOrEqual(100);
          if (failure === "second batch" && failOnce && first === 101) {
            failOnce = false;
            throw new Error("offline");
          }
          for (const episode of args.episodesInfo) committed.add(episode.episodeId);
        } else if (name === "tv:setSeriesStatus") {
          if (failure === "status update" && failOnce) {
            failOnce = false;
            throw new Error("offline");
          }
          seriesStatus = args.status;
        } else throw new Error(`Unexpected mutation: ${name}`);
        return null;
      },
    };
    const view = await mountStatus(client);
    const seasons = [{ id: 10, episodes: Array.from({ length: 205 }, (_, i) => ({ id: i + 1 })) }];
    await act(() => {
      view.current.setMarkEntireSeries(true);
      view.current.handleStatusClick("watched");
    });
    await act(async () => {
      await expect(view.current.handleWatchedConfirm(0, seasons)).rejects.toThrow("offline");
    });
    expect(committed.size).toBe(failure === "second batch" ? 100 : 205);
    expect(seriesStatus).toBeUndefined();
    expect(view.current.updating).toBe(false);
    expect(view.current.watchedDialogOpen).toBe(true);
    expect(view.current.markEntireSeries).toBe(true);

    await act(() => view.current.handleWatchedConfirm(0, seasons));
    expect(bulkStarts).toEqual(failure === "second batch" ? [1, 101, 1, 101, 201] : [1, 101, 201, 1, 101, 201]);
    expect(committed.size).toBe(205);
    expect(seriesStatus).toBe("watched");
    expect(view.current.updating).toBe(false);
    expect(view.current.watchedDialogOpen).toBe(false);
    expect(view.current.markEntireSeries).toBe(false);
  });
}
