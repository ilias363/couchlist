import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvexProvider } from "convex/react";
import { getFunctionName } from "convex/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getStatuses, hasTrackedItems } from "../convex/media";
import { listUserMovies, getRecentMoviesByStatus, setMovieStatus, deleteMovie } from "../convex/movie";
import { listUserTvSeries, getRecentTvByStatus, setSeriesStatus } from "../convex/tv";
import { getStatusBatches, STATUS_BATCH_SIZE } from "../lib/media-statuses";
import { useMediaStatuses } from "../hooks/use-media-statuses";
import { useHomeHero } from "../hooks/use-home-hero";
import TvStatusPage from "../app/(authenticated)/tv-status/page";
import { tmdbKeys } from "../lib/tmdb/react-query";

// Match the existing handler-test convention. Track indexed reads and disallow
// status scans so a return to collect() fails even with a small fixture.
function context(size = 0, subject = "owner") {
  const tables = { userMovies: [], userTvSeries: [], userEpisodes: [] };
  for (let id = 1; id <= size; id++) {
    const common = { userId: "owner", status: "on_hold", createdAt: id, updatedAt: id };
    tables.userMovies.push({ ...common, _id: `movie:${id}`, movieId: id });
    tables.userTvSeries.push({ ...common, _id: `tv:${id}`, tvSeriesId: id });
  }
  const reads = { documents: 0, queries: [] };
  const ctx = {
    auth: { getUserIdentity: async () => subject === null ? null : { subject } },
    db: {
      query(table) {
        const filters = [];
        const read = { table, filters };
        reads.queries.push(read);
        let direction = "asc";
        const rows = () => {
          if (!filters.some(([key, value]) => key === "userId" && value === subject)) {
            throw new Error("Read must be scoped to the caller");
          }
          const matches = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
          return matches.sort((a, b) => (a.updatedAt - b.updatedAt) * (direction === "asc" ? 1 : -1));
        };
        const count = result => { reads.documents += result.length; return result; };
        const query = {
          withIndex(index, build) {
            read.index = index;
            const range = { eq(key, value) { filters.push([key, value]); return range; } };
            build(range);
            const expected = {
              by_user: ["userId"], by_user_movie: ["userId", "movieId"],
              by_user_tv_series: ["userId", "tvSeriesId"], by_user_tv: ["userId", "tvSeriesId"],
              by_user_updatedAt: ["userId"], by_user_status_updatedAt: ["userId", "status"],
            }[index];
            expect(filters.map(([key]) => key)).toEqual(expected);
            return query;
          },
          order(value) { direction = value; return query; },
          async unique() {
            const matches = count(rows());
            if (matches.length > 1) throw new Error("Duplicate record");
            return matches[0] ?? null;
          },
          async first() { return count(rows().slice(0, 1))[0] ?? null; },
          async take(limit) { return count(rows().slice(0, limit)); },
          async collect() {
            if (table !== "userEpisodes") throw new Error("Unbounded status read");
            return count(rows());
          },
          async paginate({ cursor, numItems }) {
            const matches = rows();
            const offset = Number(cursor ?? 0);
            return {
              page: count(matches.slice(offset, offset + numItems)),
              isDone: offset + numItems >= matches.length,
              continueCursor: String(offset + numItems),
            };
          },
        };
        return query;
      },
      async insert(table, doc) { tables[table].push({ ...doc, _id: `${table}:${tables[table].length + 1}` }); },
      async patch(id, fields) { Object.assign(Object.values(tables).flat().find(row => row._id === id), fields); },
      async delete(id) {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex(row => row._id === id);
          if (index >= 0) rows.splice(index, 1);
        }
      },
    },
  };
  return { ctx, tables, reads };
}

test("displayed-title reads stay constant as both libraries grow beyond 1,024", async () => {
  for (const size of [30, 1025, 5000]) {
    const { ctx, reads } = context(size);
    const items = [
      { id: 1, mediaType: "movie" }, { id: size, mediaType: "tv" },
      { id: 1, mediaType: "movie" }, { id: size + 1, mediaType: "tv" },
    ];
    expect(await getStatuses._handler(ctx, { items })).toEqual([
      { id: 1, mediaType: "movie", status: "on_hold" },
      { id: size, mediaType: "tv", status: "on_hold" },
    ]);
    expect(reads.documents).toBe(2);
    expect(reads.queries).toHaveLength(3); // duplicate requested title read once
    expect(await hasTrackedItems._handler(ctx, {})).toBe(true);
    expect(reads.documents).toBe(4); // presence reads at most two records
  }
});

test("all 1,025 movies and shows remain accessible through bounded batches and pages", async () => {
  const { ctx, reads } = context(1025);
  const targets = Array.from({ length: 1025 }, (_, i) => i + 1)
    .flatMap(id => [{ id, mediaType: "movie" }, { id, mediaType: "tv" }]);
  const batches = getStatusBatches([...targets, ...targets]);
  expect(getStatusBatches([...targets].reverse())).toEqual(batches);
  expect(batches).toHaveLength(Math.ceil(2050 / STATUS_BATCH_SIZE));
  const statuses = [];
  for (const items of batches) {
    expect(items.length).toBeLessThanOrEqual(STATUS_BATCH_SIZE);
    const before = reads.documents;
    statuses.push(...await getStatuses._handler(ctx, { items }));
    expect(reads.documents - before).toBe(items.length);
  }
  expect(statuses).toHaveLength(2050);
  expect(new Set(statuses.map(item => `${item.mediaType}:${item.id}`)).size).toBe(2050);
  for (const [query, key] of [[listUserMovies, "movieId"], [listUserTvSeries, "tvSeriesId"]]) {
    let cursor = null;
    const ids = [];
    while (true) {
      const before = reads.documents;
      const page = await query._handler(ctx, { paginationOpts: { cursor, numItems: 30 } });
      expect(reads.documents - before).toBeLessThanOrEqual(30);
      ids.push(...page.page.map(item => item[key]));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(new Set(ids).size).toBe(1025);
    expect(ids).toContain(1025);
    expect(ids).toContain(1);
  }
});

test("status and presence queries cannot read another user's data", async () => {
  const { ctx, tables, reads } = context(1025, "other");
  const items = [{ id: 1025, mediaType: "movie" }, { id: 1025, mediaType: "tv" }];
  expect(await getStatuses._handler(ctx, { items })).toEqual([]);
  expect(await hasTrackedItems._handler(ctx, {})).toBe(false);
  expect(reads.documents).toBe(0);
  tables.userMovies.push({ userId: "other", movieId: 1025, status: "watched", updatedAt: 1 });
  expect(await getStatuses._handler(ctx, { items })).toEqual([
    { id: 1025, mediaType: "movie", status: "watched" },
  ]);
  expect(await hasTrackedItems._handler(ctx, {})).toBe(true);
  for (const query of [listUserMovies, listUserTvSeries]) {
    const result = await query._handler(ctx, { paginationOpts: { cursor: null, numItems: 30 } });
    expect(result.page.every(item => item.userId === "other")).toBe(true);
  }
  // Public validators expose no caller-supplied identity override.
  expect(Object.keys(JSON.parse(getStatuses.exportArgs()).value)).toEqual(["items"]);
  expect(Object.keys(JSON.parse(hasTrackedItems.exportArgs()).value)).toEqual([]);
});

test("empty, signed-out, oversized, and invalid requests never scan a library", async () => {
  const { ctx, reads } = context(1025, null);
  expect(await getStatuses._handler(ctx, { items: [{ id: 1, mediaType: "tv" }] })).toEqual([]);
  expect(await hasTrackedItems._handler(ctx, {})).toBe(false);
  expect(reads.queries).toHaveLength(0);
  const signedIn = context(1025);
  expect(await getStatuses._handler(signedIn.ctx, { items: [] })).toEqual([]);
  await expect(getStatuses._handler(signedIn.ctx, {
    items: Array.from({ length: STATUS_BATCH_SIZE + 1 }, (_, id) => ({ id: id + 1, mediaType: "movie" })),
  })).rejects.toThrow("at most 100");
  for (const id of [0, -1, 1.5, NaN, Infinity]) {
    await expect(getStatuses._handler(signedIn.ctx, { items: [{ id, mediaType: "movie" }] }))
      .rejects.toThrow("positive integers");
  }
  expect(signedIn.reads.queries).toHaveLength(0);
});

test("writes and removals are reflected by bounded status reads and recent rows", async () => {
  const { ctx } = context(1025);
  const items = [{ id: 1025, mediaType: "movie" }, { id: 1025, mediaType: "tv" }];
  await setMovieStatus._handler(ctx, { movieId: 1025, status: "want_to_watch" });
  await setSeriesStatus._handler(ctx, { tvSeriesId: 1025, status: "currently_watching" });
  expect((await getStatuses._handler(ctx, { items })).map(item => item.status))
    .toEqual(["want_to_watch", "currently_watching"]);
  expect(await getRecentMoviesByStatus._handler(ctx, { statuses: ["want_to_watch"], limit: 20 }))
    .toEqual([expect.objectContaining({ movieId: 1025, status: "want_to_watch" })]);
  expect(await getRecentTvByStatus._handler(ctx, { statuses: ["currently_watching"], limit: 20 }))
    .toEqual([expect.objectContaining({ tvSeriesId: 1025, status: "currently_watching" })]);
  const filtered = await listUserTvSeries._handler(ctx, {
    status: "currently_watching", paginationOpts: { cursor: null, numItems: 30 },
  });
  expect(filtered.page.map(row => row.tvSeriesId)).toEqual([1025]);
  await deleteMovie._handler(ctx, { movieId: 1025 });
  expect(await getStatuses._handler(ctx, { items })).toEqual([
    { id: 1025, mediaType: "tv", status: "currently_watching" },
  ]);
});

// Exercise the real React/Convex hooks without mocking the convex/react module
// (which would leak into the other Bun tests).
function renderStatuses(items, result) {
  let value;
  const requests = [];
  const client = {
    watchQuery(query, args) {
      requests.push({ name: getFunctionName(query), ...args });
      return { localQueryResult: () => {
        if (result instanceof Error) throw result;
        return typeof result === "function" ? result(args.items) : result;
      } };
    },
  };
  // eslint-disable-next-line react-hooks/globals -- Capture the SSR hook result for assertions.
  function Probe() { value = useMediaStatuses(items); return null; }
  renderToStaticMarkup(<ConvexProvider client={client}><Probe /></ConvexProvider>);
  return { ...value, requests };
}

test("displayed-title hook batches, deduplicates, and reuses statuses supplied by source rows", () => {
  const items = Array.from({ length: 1025 }, (_, i) => ({ id: i + 1, media_type: "movie" }));
  const known = { id: 1026, media_type: "tv", watchStatus: "up_to_date" };
  const view = renderStatuses([...items, ...items, known, { id: 20, media_type: "person" }], batch =>
    batch.map(item => ({ ...item, status: "on_hold" })),
  );
  expect(view.isLoading).toBe(false);
  expect(view.requests).toHaveLength(11);
  expect(view.requests.every(request => request.name === "media:getStatuses" && request.items.length <= 100)).toBe(true);
  expect(view.requests.flatMap(request => request.items)).toHaveLength(1025);
  expect(view.getStatus(1025, "movie")).toBe("on_hold");
  expect(view.getStatus(1026, "tv")).toBe("up_to_date");
  expect(renderStatuses([known], []).requests).toEqual([]);
  expect(renderStatuses([], undefined).isLoading).toBe(false);
});

test("displayed-title hook preserves loading, errors, changed status, and removal", () => {
  const items = [{ id: 1, media_type: "movie" }];
  expect(renderStatuses(items, undefined).isLoading).toBe(true);
  expect(renderStatuses(items, [{ id: 1, mediaType: "movie", status: "watched" }]).getStatus(1, "movie"))
    .toBe("watched");
  expect(renderStatuses(items, []).getStatus(1, "movie")).toBeUndefined();
  expect(() => renderStatuses(items, new Error("query failed"))).toThrow("query failed");
});

function renderConsumer(child, resolve, seed = () => {}) {
  const requests = [];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(queryClient);
  const client = {
    watchQuery(query, args) {
      const name = getFunctionName(query);
      requests.push({ name, args });
      return { localQueryResult: () => resolve(name, args) };
    },
  };
  const html = renderToStaticMarkup(
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>{child}</QueryClientProvider>
    </ConvexProvider>,
  );
  queryClient.clear();
  return { html, requests };
}

test("hero uses presence and recent row statuses for empty, completed-only, and active libraries", () => {
  const trending = {
    id: 99, media_type: "movie", title: "Trending", overview: "", backdrop_path: "/backdrop.jpg",
  };
  let hero;
  // eslint-disable-next-line react-hooks/globals -- Capture the SSR hook result for assertions.
  function Probe() { hero = useHomeHero(); return null; }
  for (const presence of [undefined, false, true]) {
    const { requests } = renderConsumer(<Probe />, name =>
      name === "media:hasTrackedItems" ? presence : [],
    cache => cache.setQueryData(tmdbKeys.category("movie", "trending"), {
      pages: [{ results: [trending] }], pageParams: [1],
    }));
    expect(hero.mode).toBe(presence === undefined ? "loading" : presence ? "personalized" : "onboarding");
    expect(requests.every(request => [
      "media:hasTrackedItems", "movie:getRecentMoviesByStatus", "tv:getRecentTvByStatus",
    ].includes(request.name))).toBe(true);
  }
  renderConsumer(<Probe />, (name, args) => {
    if (name === "media:hasTrackedItems") return true;
    if (name === "movie:getRecentMoviesByStatus" && args.statuses[0] === "on_hold") {
      return [{ movieId: 1025, status: "on_hold", updatedAt: 10 }];
    }
    return [];
  }, cache => cache.setQueryData(tmdbKeys.movie(1025), {
    id: 1025, title: "Tracked", overview: "", backdrop_path: "/backdrop.jpg",
  }));
  expect(hero.feature).toMatchObject({ id: 1025, status: "on_hold", source: "continue" });
});

test("TV overview requests one page, uses its statuses, and keeps later titles reachable", () => {
  const records = [{ tvSeriesId: 1025, status: "up_to_date" }];
  for (const isDone of [false, true]) {
    const { html, requests } = renderConsumer(<TvStatusPage />, () => ({
      page: records, isDone, continueCursor: "next",
    }), cache => cache.setQueryData(tmdbKeys.tv(1025), { id: 1025, name: "Series 1025", status: "Ended" }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      name: "tv:listUserTvSeries", args: { paginationOpts: { numItems: 30, cursor: null } },
    });
    expect(html).toContain("Series 1025");
    expect(html).toContain("Up to Date");
    expect(html.includes("Load more series")).toBe(!isDone);
    expect(html.includes("apply to loaded series")).toBe(!isDone);
  }
  const { html } = renderConsumer(<TvStatusPage />, () => ({ page: [], isDone: true, continueCursor: "" }));
  expect(html).toContain("No series found");
  expect(html).not.toContain("Load more series");
});
