import { expect, test } from "bun:test";
import { deriveWatchSummary } from "../convex/lib/tvWatchDates";
import { bulkToggleSeasonEpisodes, getSeriesStatus, setSeriesStatus, toggleEpisodeWatched } from "../convex/tv";
import { bulkToggleSeasonInBatches } from "../lib/tv-watch-batches";

// Run the real mutation handlers against a small in-memory database.
function context() {
  const tables = { dataOperations: [], statsRebuilds: [], userTvSeries: [], userEpisodes: [], userMovies: [] };
  const scheduled = [];
  const reads = [];
  const readRows = [];
  let sequence = 0;
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "user" }) },
    scheduler: { runAfter: async (_delay, _ref, args) => scheduled.push(args) },
    db: {
      query(table) {
        reads.push(table);
        const filters = [];
        let fields = [];
        let direction = 1;
        const rows = () => tables[table].filter(row => filters.every(match => match(row))).sort((a, b) => {
          for (const field of fields) {
            if (a[field] < b[field]) return -direction;
            if (a[field] > b[field]) return direction;
          }
          return 0;
        });
        const record = matches => {
          readRows.push(...matches.map(row => ({ table, id: row._id })));
          return structuredClone(matches);
        };
        const query = {
          withIndex(index, build) {
            fields = index === "by_userId_tvSeriesId_isWatched_watchedDate" ? ["userId", "tvSeriesId", "isWatched", "watchedDate"] : [];
            const range = {
              eq: (key, value) => { filters.push(row => row[key] === value); return range; },
              gte: (key, value) => { filters.push(row => row[key] >= value); return range; },
              lte: (key, value) => { filters.push(row => row[key] <= value); return range; },
            };
            build(range);
            return query;
          },
          order: order => { direction = order === "desc" ? -1 : 1; return query; },
          collect: async () => record(rows()),
          first: async () => record(rows().slice(0, 1))[0] ?? null,
          take: async n => record(rows().slice(0, n)),
          unique: async () => {
            const matches = record(rows());
            if (matches.length > 1) throw new Error("Duplicate record");
            return matches[0] ?? null;
          },
          paginate: async ({ cursor, numItems }) => {
            const all = rows();
            const offset = Number(cursor ?? 0);
            return {
              page: record(all.slice(offset, offset + numItems)),
              isDone: offset + numItems >= all.length,
              continueCursor: String(offset + numItems),
            };
          },
        };
        return query;
      },
      async insert(table, doc) {
        const _id = `${table}:${++sequence}`;
        tables[table].push({ ...doc, _id });
        return _id;
      },
      async patch(id, fields) {
        const row = Object.values(tables).flat().find(doc => doc._id === id);
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) delete row[key];
          else row[key] = value;
        }
      },
      async delete(id) {
        for (const table of Object.values(tables)) {
          const index = table.findIndex(doc => doc._id === id);
          if (index !== -1) table.splice(index, 1);
        }
      },
    },
  };
  return { ctx, tables, reads, readRows, scheduled };
}

test("summary counts watched episodes even without valid dates", () => {
  expect(deriveWatchSummary([
    { seasonId: 10, isWatched: true },
    { seasonId: 10, isWatched: true, watchedDate: NaN },
    { seasonId: 10, isWatched: false, watchedDate: 1 },
    { seasonId: 20, isWatched: true, watchedDate: 200 },
    { seasonId: 20, isWatched: true, watchedDate: 100 },
  ])).toEqual({ startedAt: 100, lastWatchedAt: 200, seasonWatchedCounts: { 10: 2, 20: 2 } });
});

test("individual watches, retries, status changes, and last-episode removal keep counts correct", async () => {
  const { ctx, tables, reads } = context();
  const episode = { tvSeriesId: 1, seasonId: 10, episodeId: 100, isWatched: true };
  await toggleEpisodeWatched._handler(ctx, episode);
  await toggleEpisodeWatched._handler(ctx, episode);
  await setSeriesStatus._handler(ctx, { tvSeriesId: 1, status: "on_hold" });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({ 10: 1 });

  reads.length = 0;
  const series = await getSeriesStatus._handler(ctx, { tvSeriesId: 1 });
  expect(series.seasonWatchedCounts).toEqual({ 10: 1 });
  expect(reads).toEqual(["userTvSeries"]);

  await toggleEpisodeWatched._handler(ctx, { ...episode, isWatched: false });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({});
  expect(tables.userTvSeries[0].status).toBe("on_hold");
});

test("bulk watches count once, preserve existing dates, and clear removed seasons", async () => {
  const { ctx, tables } = context();
  await toggleEpisodeWatched._handler(ctx, {
    tvSeriesId: 1, seasonId: 10, episodeId: 100, isWatched: true, watchedAt: 1000,
  });
  const season = {
    tvSeriesId: 1, seasonId: 10, episodesInfo: [{ episodeId: 100 }, { episodeId: 101 }], isWatched: true,
  };
  await bulkToggleSeasonEpisodes._handler(ctx, season);
  await bulkToggleSeasonEpisodes._handler(ctx, { ...season, watchedAt: 9999 });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({ 10: 2 });
  expect(tables.userEpisodes.find(ep => ep.episodeId === 100).watchedDate).toBe(1000);
  expect(tables.userEpisodes.find(ep => ep.episodeId === 101).watchedDate).toBeUndefined();
  await bulkToggleSeasonEpisodes._handler(ctx, { ...season, isWatched: false });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({});
  expect(tables.userTvSeries[0].startedAt).toBeUndefined();
});

function seedHistory(size) {
  const state = context();
  state.tables.userEpisodes = Array.from({ length: size }, (_, i) => ({
    _id: `history:${i}`, userId: "user", tvSeriesId: 1, seasonId: 10,
    episodeId: i + 1, isWatched: true, watchedDate: i, createdAt: 1, updatedAt: 2,
  }));
  state.tables.userTvSeries.push({
    _id: "series", userId: "user", tvSeriesId: 1, status: "on_hold", createdAt: 1, updatedAt: 2,
    ...deriveWatchSummary(state.tables.userEpisodes),
  });
  state.episodeReads = () => state.readRows.filter(r => r.table === "userEpisodes").length;
  state.check = () => {
    const summary = deriveWatchSummary(state.tables.userEpisodes);
    for (const field of ["startedAt", "lastWatchedAt", "seasonWatchedCounts"]) {
      expect(state.tables.userTvSeries[0][field]).toEqual(summary[field]);
    }
  };
  return state;
}

test("episode read counts stay bounded at 20 and 1000 rows; status edits read zero episodes", async () => {
  const results = [];
  for (const size of [20, 1000]) {
    const state = seedHistory(size);
    const { ctx, readRows } = state;
    const change = { tvSeriesId: 1, seasonId: 10, episodeId: 10, isWatched: true, watchedAt: 5 };
    await toggleEpisodeWatched._handler(ctx, change);
    state.check();
    const ordinary = state.episodeReads();
    readRows.length = 0;
    await toggleEpisodeWatched._handler(ctx, { ...change, episodeId: 1, isWatched: false });
    state.check();
    const boundary = state.episodeReads();
    readRows.length = 0;
    await setSeriesStatus._handler(ctx, { tvSeriesId: 1, status: "watched" });
    state.check();
    results.push({ size, ordinary, boundary, status: state.episodeReads() });
  }
  expect(results).toEqual([
    { size: 20, ordinary: 1, boundary: 2, status: 0 },
    { size: 1000, ordinary: 1, boundary: 2, status: 0 },
  ]);
});

test("min/max changes, ties, zero/negative dates, clears and unknown dates match the history oracle", async () => {
  const state = seedHistory(0);
  const episode = { tvSeriesId: 1, seasonId: 10, isWatched: true };
  for (const [episodeId, watchedAt] of [[1, -10], [2, -10], [3, 0], [4, 0], [5, undefined]]) {
    await toggleEpisodeWatched._handler(state.ctx, { ...episode, episodeId, watchedAt });
    state.check();
  }
  for (const [episodeId, watchedAt] of [[1, 20], [2, undefined], [1, -20], [3, undefined]]) {
    state.readRows.length = 0;
    await toggleEpisodeWatched._handler(state.ctx, { ...episode, episodeId, watchedAt });
    state.check();
    expect(state.episodeReads()).toBeLessThanOrEqual(3);
  }
  for (const episodeId of [4, 1, 5, 2, 3]) {
    await toggleEpisodeWatched._handler(state.ctx, { ...episode, episodeId, isWatched: false });
    state.check();
  }
});

test("ten fresh 20-episode seasons read no episodes for rebuilds, and retries read only their own rows", async () => {
  const { ctx, tables, readRows } = context();
  const episodeReads = () => readRows.filter(row => row.table === "userEpisodes").length;
  const seasons = Array.from({ length: 10 }, (_, i) => ({
    tvSeriesId: 1, seasonId: i + 10, isWatched: true, watchedAt: 0,
    episodesInfo: Array.from({ length: 20 }, (_, j) => ({ episodeId: i * 20 + j + 1 })),
  }));
  for (const season of seasons) await bulkToggleSeasonEpisodes._handler(ctx, season);
  await setSeriesStatus._handler(ctx, { tvSeriesId: 1, status: "watched" });
  expect(episodeReads()).toBe(0);
  readRows.length = 0;
  for (const season of seasons) await bulkToggleSeasonEpisodes._handler(ctx, { ...season, watchedAt: 100 });
  expect(episodeReads()).toBe(200);
  expect(tables.userTvSeries[0]).toMatchObject({ status: "watched", startedAt: 0, lastWatchedAt: 0 });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual(Object.fromEntries(seasons.map(s => [s.seasonId, 20])));
  readRows.length = 0;
  for (const season of seasons) await bulkToggleSeasonEpisodes._handler(ctx, { ...season, isWatched: false });
  expect(episodeReads()).toBeLessThanOrEqual(220);
  expect(tables.userTvSeries[0]).toMatchObject({ status: "watched", seasonWatchedCounts: {} });
  expect(tables.userTvSeries[0].startedAt).toBeUndefined();
});

test("season bulk retries/removals read only that batch and boundaries at 20 and 1000 history rows", async () => {
  for (const size of [20, 1000]) {
    const state = seedHistory(size);
    const args = { tvSeriesId: 1, seasonId: 20, isWatched: true, watchedAt: -1,
      episodesInfo: Array.from({ length: 20 }, (_, i) => ({ episodeId: size + i + 1 })),
    };
    await bulkToggleSeasonEpisodes._handler(state.ctx, args);
    state.check();
    expect(state.episodeReads()).toBe(0);
    state.readRows.length = 0;
    await bulkToggleSeasonEpisodes._handler(state.ctx, { ...args, watchedAt: 10000 });
    state.check();
    expect(state.episodeReads()).toBe(20);
    state.readRows.length = 0;
    await bulkToggleSeasonEpisodes._handler(state.ctx, { ...args, isWatched: false });
    state.check();
    expect(state.episodeReads()).toBe(21);
  }
});

test("legacy and orphan history is preserved by status edits and refuses episode edits until repaired", async () => {
  for (const missingParent of [false, true]) {
    const { ctx, tables, readRows, episodeReads } = seedHistory(1000);
    if (missingParent) tables.userTvSeries.length = 0;
    else delete tables.userTvSeries[0].seasonWatchedCounts;
    await setSeriesStatus._handler(ctx, { tvSeriesId: 1, status: "dropped" });
    expect(tables.userTvSeries[0].seasonWatchedCounts).toBeUndefined();
    expect(episodeReads()).toBe(missingParent ? 1 : 0);
    if (!missingParent) expect(tables.userTvSeries[0].lastWatchedAt).toBe(999);
    const snapshot = structuredClone(tables);
    readRows.length = 0;
    await expect(toggleEpisodeWatched._handler(ctx, { tvSeriesId: 1, seasonId: 10, episodeId: 10, isWatched: false })).rejects.toThrow("needs repair");
    expect(tables).toEqual(snapshot);
    expect(episodeReads()).toBe(2);
  }
});

test("oversized season actions are chunked sequentially, retries preserve dates, and failures stop later batches", async () => {
  const { ctx, tables } = context();
  const args = { tvSeriesId: 1, seasonId: 10, isWatched: true, watchedAt: -1,
    episodesInfo: Array.from({ length: 205 }, (_, i) => ({ episodeId: i + 1 })),
  };
  await expect(bulkToggleSeasonEpisodes._handler(ctx, args)).rejects.toThrow("100");
  expect(tables.userEpisodes).toEqual([]);
  const sizes = [];
  const mutate = async batch => { sizes.push(batch.episodesInfo.length); await bulkToggleSeasonEpisodes._handler(ctx, batch); };
  await bulkToggleSeasonInBatches(mutate, args);
  expect(sizes).toEqual([100, 100, 5]);
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({ 10: 205 });
  await bulkToggleSeasonInBatches(mutate, { ...args, watchedAt: 999 });
  expect(tables.userTvSeries[0].startedAt).toBe(-1);
  let calls = 0;
  await expect(bulkToggleSeasonInBatches(async () => {
    if (++calls === 2) throw new Error("offline");
  }, args)).rejects.toThrow("offline");
  expect(calls).toBe(2);
  calls = 0;
  await expect(bulkToggleSeasonInBatches(async () => { calls++; }, {
    ...args, episodesInfo: [...args.episodesInfo, { episodeId: 1 }],
  })).rejects.toThrow("Duplicate");
  expect(calls).toBe(0);
});
