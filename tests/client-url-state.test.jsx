import { afterEach, expect, mock, setSystemTime, spyOn, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { ConvexProvider } from "convex/react";
import { getFunctionName } from "convex/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import MoviesPage from "../app/(authenticated)/movies/page";
import TvSeriesPage from "../app/(authenticated)/tv-series/page";
import { tmdbClient } from "../lib/tmdb/client-api";

mock.module("server-only", () => ({}));
const { AuthKitProvider } = await import("@workos-inc/authkit-nextjs/components");
const { default: SearchPage } = await import("../app/(authenticated)/search/page");
const { LastPageTracker } = await import("../components/last-page-tracker");

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function mount(Page, path) {
  // Keep lodash's debounce clock deterministic even on a busy build machine.
  setSystemTime(new Date("2026-10-21T12:00:00Z"));
  const window = new Window({ url: `http://localhost:3000${path}` });
  const globals = {
    window, document: window.document, navigator: window.navigator,
    localStorage: window.localStorage, HTMLElement: window.HTMLElement, Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const queries = [];
  const client = {
    watchQuery(ref, args) {
      queries.push({ name: getFunctionName(ref), args });
      return {
        localQueryResult: () => ({ page: [], isDone: args.paginationOpts.cursor !== null, continueCursor: "next" }),
        onUpdate: () => () => {}, journal: () => undefined,
      };
    },
  };
  const searches = [];
  const spies = ["searchMulti", "searchMovies", "searchTVSeries"].map(method =>
    spyOn(tmdbClient, method).mockImplementation(async (q, page, signal) => {
      searches.push({ method, q, page, signal });
      return { results: [], page, total_pages: 1, total_results: 0 };
    }),
  );
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  let mounted = true;
  const unmount = () => {
    if (mounted) root.unmount();
    mounted = false;
  };
  const render = () => root.render(
    <StrictMode><AuthKitProvider initialAuth={{ user: { id: "url-user" } }} onSessionExpired={false}>
      <ConvexProvider client={client}><QueryClientProvider client={cache}>
        <PathnameContext.Provider value={window.location.pathname}>
          <SearchParamsContext.Provider value={new URLSearchParams(window.location.search)}>
            <Page /><LastPageTracker />
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </QueryClientProvider></ConvexProvider>
    </AuthKitProvider></StrictMode>,
  );
  // Model Next's documented native-history -> useSearchParams notification.
  // The transport is local; this test does not assert real RSC network traffic.
  const nativeReplace = window.history.replaceState.bind(window.history);
  const replace = spyOn(window.history, "replaceState").mockImplementation((...args) => {
    nativeReplace(...args);
    render();
  });
  window.addEventListener("popstate", render);
  cleanups.push(async () => {
    await act(unmount);
    cache.clear();
    spies.forEach(spy => spy.mockRestore());
    replace.mockRestore();
    await window.happyDOM.abort();
    setSystemTime();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await act(render);
  const wait = (ms = 0) => act(async () => {
    if (ms) setSystemTime(Date.now() + ms);
    await new Promise(resolve => setTimeout(resolve, ms));
  });
  await wait();
  return {
    window, container, queries, searches, replace, wait,
    unmount: () => act(unmount),
    input: () => container.querySelector("input"),
    async type(value) {
      const input = container.querySelector("input");
      // Invoke React's change handler independently of happy-dom's input-event emulation.
      const props = input[Object.keys(input).find(key => key.startsWith("__reactProps$"))];
      await act(() => props.onChange({ target: { value } }));
    },
    async click(label) {
      const button = [...container.querySelectorAll("button")].find(button => button.textContent.trim() === label);
      expect(button).toBeDefined();
      await act(() => button.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
      await wait();
    },
    async link(path) {
      await act(() => { window.history.pushState(null, "", path); render(); });
      await wait();
    },
    async traverse(direction) {
      await act(async () => { window.history[direction](); await new Promise(resolve => setTimeout(resolve, 0)); });
      await wait();
    },
    saved: () => window.localStorage.getItem("couchlist:last-page:url-user"),
  };
}

test("search debounces q, keeps pending input on mode changes, and replaces only changed URLs", async () => {
  const view = await mount(SearchPage, "/search?q=matrix&source=a%20b#results");
  const { window } = view;
  const length = window.history.length;
  expect(view.input().value).toBe("matrix");
  expect(view.replace).not.toHaveBeenCalled();
  await view.type("  alien  ");
  expect(window.location.search).toContain("q=matrix");
  await view.click("Movies");
  expect(view.input().value).toBe("  alien  ");
  await view.wait(550);
  expect(new URLSearchParams(window.location.search).get("q")).toBe("alien");
  expect(new URLSearchParams(window.location.search).get("mode")).toBe("movie");
  expect(new URLSearchParams(window.location.search).get("source")).toBe("a b");
  expect(window.location.hash).toBe("#results");
  expect(window.history.length).toBe(length);
  expect(view.searches.some(call => call.method === "searchMovies" && call.q === "alien")).toBe(true);
  expect(view.saved()).toBe(window.location.pathname + window.location.search);
  const writes = view.replace.mock.calls.length;
  await view.click("Movies");
  await view.type("alien ");
  await view.wait(550);
  expect(view.replace.mock.calls.length).toBe(writes);
  await view.type("");
  await view.wait(550);
  await view.click("All");
  expect(window.location.search).toBe("?source=a+b");
  expect(window.location.hash).toBe("#results");
});

test("search Back/Forward and same-page links restore state and cancel stale debounce, including unchanged q", async () => {
  const view = await mount(SearchPage, "/search?q=matrix&mode=movie");
  await view.link("/search?q=matrix&mode=tv&source=direct#saved");
  await view.type("stale");
  await view.traverse("back");
  expect(view.input().value).toBe("matrix");
  await view.wait(550);
  expect(view.window.location.search).toBe("?q=matrix&mode=movie");
  expect(view.searches.some(call => call.q === "stale")).toBe(false);
  await view.traverse("forward");
  expect(view.input().value).toBe("matrix");
  expect(view.searches.some(call => call.method === "searchTVSeries" && call.q === "matrix")).toBe(true);
  await view.type("another stale search");
  await view.link("/search?q=arrival&mode=movie");
  expect(view.input().value).toBe("arrival");
  await view.wait(550);
  expect(view.window.location.search).toBe("?q=arrival&mode=movie");
  expect(view.replace).not.toHaveBeenCalled();
  expect(view.saved()).toBe("/search?q=arrival&mode=movie");
  await view.type("unmounted search");
  await view.unmount();
  await view.wait(550);
  expect(view.replace).not.toHaveBeenCalled();
});

for (const [Page, path, name, pageSize] of [
  [MoviesPage, "/movies", "movie:listUserMovies", 30],
  [TvSeriesPage, "/tv-series", "tv:listUserTvSeries", 60],
]) {
  test(`${path} filters preserve URL state, pagination, and Back/Forward synchronization`, async () => {
    const view = await mount(Page, `${path}?status=watched&source=a%20b#list`);
    const { window } = view;
    const length = window.history.length;
    expect(view.replace).not.toHaveBeenCalled();
    await view.click("Watched");
    expect(view.replace).not.toHaveBeenCalled();
    expect(view.queries.some(query => query.name === name && query.args.status === "watched")).toBe(true);
    await view.click("Load More");
    expect(view.queries.some(query => query.args.paginationOpts.cursor === "next" && query.args.paginationOpts.numItems === pageSize)).toBe(true);
    await view.click("On Hold");
    expect(new URLSearchParams(window.location.search).get("status")).toBe("on_hold");
    expect(view.queries.at(-1).args.status).toBe("on_hold");
    expect(view.queries.at(-1).args.paginationOpts.cursor).toBeNull();
    expect(new URLSearchParams(window.location.search).get("source")).toBe("a b");
    expect(window.location.hash).toBe("#list");
    expect(window.history.length).toBe(length);
    expect(view.saved()).toBe(window.location.pathname + window.location.search);
    await view.link(`${path}?status=dropped#other`);
    await view.traverse("back");
    expect(view.queries.at(-1).args.status).toBe("on_hold");
    await view.traverse("forward");
    expect(view.queries.at(-1).args.status).toBe("dropped");
    await view.click("All");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#other");
    expect(view.queries.at(-1).args.status).toBeUndefined();
    const writes = view.replace.mock.calls.length;
    await view.click("All");
    expect(view.replace.mock.calls.length).toBe(writes);
  });
}
