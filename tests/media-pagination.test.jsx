import { afterEach, expect, spyOn, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { ConvexProvider } from "convex/react";
import { getFunctionName } from "convex/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMediaStatuses } from "../hooks/use-media-statuses";
import TvStatusPage from "../app/(authenticated)/tv-status/page";
import { tmdbClient } from "../lib/tmdb/client-api";
import { tmdbKeys } from "../lib/tmdb/react-query";

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function mount() {
  const window = new Window({ url: "http://localhost:3000" });
  const globals = {
    window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Node: window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(() => root.unmount());
    await window.happyDOM.abort();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { container, window, render: children => act(() => root.render(children)) };
}

// Let the real Convex hooks manage subscriptions and pagination. Only replace
// their transport so tests control when each server response arrives.
function queryClient(resolve) {
  const entries = new Map();
  return {
    entries,
    watchQuery(query, args) {
      const name = getFunctionName(query);
      const key = JSON.stringify([name, args]);
      if (!entries.has(key)) entries.set(key, { name, args, value: resolve(name, args), listeners: new Set() });
      const entry = entries.get(key);
      return {
        localQueryResult: () => entry.value,
        onUpdate(callback) { entry.listeners.add(callback); return () => entry.listeners.delete(callback); },
        journal: () => undefined,
      };
    },
    publish(matches, value) {
      for (const entry of entries.values()) {
        if (!matches(entry)) continue;
        entry.value = typeof value === "function" ? value(entry.args) : value;
        for (const listener of entry.listeners) listener();
      }
    },
  };
}

function Statuses({ items, userId }) {
  const { getStatus, isStatusLoading, isLoading } = useMediaStatuses(items, userId);
  return (
    <div data-loading={isLoading}>
      {items.map(item => (
        <output key={item.id} data-id={item.id} data-status-loading={isStatusLoading(item.id, item.media_type)}>
          {getStatus(item.id, item.media_type) ?? ""}
        </output>
      ))}
      <output data-removed>{getStatus(101, "movie") ?? ""}</output>
    </div>
  );
}

test("mounted status subscriptions retain tracked and untracked readiness during re-batching, then apply updates and removals", async () => {
  const view = mount();
  let pending = false;
  const client = queryClient((_name, { items }) => pending ? undefined :
    items.filter(item => item.id !== 103).map(item => ({ ...item, status: "on_hold" })));
  let items = Array.from({ length: 200 }, (_, i) => ({ id: i + 101, media_type: "movie" }));
  const render = () => view.render(<ConvexProvider client={client}><Statuses items={items} userId="owner" /></ConvexProvider>);
  await render();
  expect(view.container.querySelector('[data-id="102"]').textContent).toBe("on_hold");
  expect(view.container.querySelector('[data-id="103"]').textContent).toBe("");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(0);

  pending = true;
  items = [...items, { id: 1, media_type: "movie" }];
  await render();
  expect(view.container.querySelector('[data-id="102"]').textContent).toBe("on_hold");
  expect(view.container.querySelector('[data-id="1"]').textContent).toBe("");
  expect(view.container.querySelector('[data-id="103"]').textContent).toBe("");
  const pendingStatuses = view.container.querySelectorAll('[data-status-loading="true"]');
  expect(pendingStatuses).toHaveLength(1);
  expect(pendingStatuses[0].getAttribute("data-id")).toBe("1");
  expect(view.container.querySelector('[data-loading="true"]')).not.toBeNull();
  const active = [...client.entries.values()].filter(entry => entry.listeners.size);
  expect(active).toHaveLength(3);
  expect(active.every(entry => entry.args.items.length <= 100)).toBe(true);

  items = items.filter(item => item.id !== 101);
  await render();
  expect(view.container.querySelector("[data-removed]").textContent).toBe("");
  expect(view.container.querySelector('[data-id="102"]').textContent).toBe("on_hold");
  await act(() => client.publish(entry => entry.listeners.size > 0, ({ items }) =>
    items.filter(item => item.id !== 102).map(item => ({ ...item, status: "watched" })),
  ));
  expect(view.container.querySelector('[data-id="102"]').textContent).toBe("");
  expect(view.container.querySelector('[data-id="103"]').textContent).toBe("watched");
  expect(view.container.querySelector('[data-id="1"]').textContent).toBe("watched");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(0);
  expect(view.container.querySelector('[data-loading="false"]')).not.toBeNull();
});

test("mounted status cache is cleared on account changes and sign-out", async () => {
  const view = mount();
  const client = queryClient((_name, { items }) => items.filter(item => item.id === 1).map(item => ({ ...item, status: "watched" })));
  const items = [{ id: 1, media_type: "movie" }, { id: 2, media_type: "movie" }];
  const render = userId => view.render(<ConvexProvider client={client}><Statuses items={items} userId={userId} /></ConvexProvider>);
  await render("owner");
  expect(view.container.querySelector("output").textContent).toBe("watched");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(0);
  await act(() => client.publish(() => true, undefined));
  expect(view.container.querySelector("output").textContent).toBe("watched");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(0);
  await render("other");
  expect(view.container.querySelector("output").textContent).toBe("");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(2);
  await act(() => client.publish(() => true, [{ id: 1, mediaType: "movie", status: "on_hold" }]));
  expect(view.container.querySelector("output").textContent).toBe("on_hold");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(0);
  await act(() => client.publish(() => true, undefined));
  await render(undefined);
  expect(view.container.querySelector("output").textContent).toBe("");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(2);
  await render("other");
  expect(view.container.querySelector("output").textContent).toBe("");
  expect(view.container.querySelectorAll('[data-status-loading="true"]')).toHaveLength(2);
});

test("TV pagination keeps existing table and rows mounted while the next page's TMDB details load", async () => {
  const view = mount();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cleanups.push(() => cache.clear());
  cache.setQueryData(tmdbKeys.tv(1), { id: 1, name: "First series", status: "Ended" });
  let finishDetails;
  const details = spyOn(tmdbClient, "getTVSeriesDetails").mockImplementation(() => new Promise(resolve => { finishDetails = resolve; }));
  cleanups.push(() => details.mockRestore());
  const client = queryClient((_name, { paginationOpts }) => paginationOpts.cursor === null
    ? { page: [{ tvSeriesId: 1, status: "watched" }], isDone: false, continueCursor: "next" }
    : undefined);
  await view.render(
    <ConvexProvider client={client}><QueryClientProvider client={cache}><TvStatusPage /></QueryClientProvider></ConvexProvider>,
  );
  const table = view.container.querySelector("table");
  const row = table.querySelector("tbody tr");
  const loadMore = [...view.container.querySelectorAll("button")].find(button => button.textContent === "Load more series");
  await act(() => loadMore.dispatchEvent(new view.window.MouseEvent("click", { bubbles: true })));
  expect(view.container.querySelector("table") === table).toBe(true);
  await act(() => client.publish(entry => entry.args.paginationOpts.cursor === "next", {
    page: [{ tvSeriesId: 2, status: "on_hold" }], isDone: true, continueCursor: "done",
  }));
  expect(details).toHaveBeenCalledWith(2, expect.any(AbortSignal));
  expect(view.container.querySelector("table") === table).toBe(true);
  expect(table.querySelector("tbody tr") === row).toBe(true);
  expect(row.textContent).toContain("First series");
  expect(view.container.textContent).toContain("Loading series details...");
  await act(async () => {
    finishDetails({ id: 2, name: "Second series", status: "Returning Series" });
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(view.container.querySelector("table") === table).toBe(true);
  expect(view.container.textContent).toContain("Second series");
  expect(view.container.textContent).not.toContain("Loading series details...");
});
