import { expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveWatchSummary, refreshSeriesWatchSummary } from "../convex/lib/tvWatchDates";
import { bulkToggleSeasonEpisodes, getSeriesStatus, setSeriesStatus, toggleEpisodeWatched } from "../convex/tv";
import { backfillSeasonWatchedCounts } from "../convex/migrations";
import { SeasonsSection } from "../components/tv-details/seasons-section";

// Run the real mutation handlers against a small in-memory database.
function context() {
  const tables = { dataOperations: [], userTvSeries: [], userEpisodes: [], userMovies: [] };
  const scheduled = [];
  const reads = [];
  let sequence = 0;
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "user" }) },
    scheduler: { runAfter: async (_delay, _ref, args) => scheduled.push(args) },
    db: {
      query(table) {
        reads.push(table);
        const filters = [];
        const rows = () => tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
        const query = {
          withIndex(_index, build) {
            const range = { eq: (key, value) => { filters.push([key, value]); return range; } };
            build(range);
            return query;
          },
          collect: async () => rows(),
          unique: async () => {
            const matches = rows();
            if (matches.length > 1) throw new Error("Duplicate record");
            return matches[0] ?? null;
          },
          paginate: async ({ cursor, numItems }) => {
            const all = rows();
            const offset = Number(cursor ?? 0);
            return {
              page: all.slice(offset, offset + numItems),
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
  return { ctx, tables, reads, scheduled };
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
  await bulkToggleSeasonEpisodes._handler(ctx, season);
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({ 10: 2 });
  expect(tables.userEpisodes.find(ep => ep.episodeId === 100).watchedDate).toBe(1000);
  expect(tables.userEpisodes.find(ep => ep.episodeId === 101).watchedDate).toBeUndefined();
  await bulkToggleSeasonEpisodes._handler(ctx, { ...season, isWatched: false });
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({});
  expect(tables.userTvSeries[0].startedAt).toBeUndefined();
});

test("repair detects count-only changes and is idempotent", async () => {
  const { ctx, tables } = context();
  await toggleEpisodeWatched._handler(ctx, { tvSeriesId: 1, seasonId: 10, episodeId: 100, isWatched: true });
  tables.userTvSeries[0].seasonWatchedCounts = { 99: 1 };
  expect(await refreshSeriesWatchSummary(ctx, "user", 1, true)).toBe("updated");
  expect(tables.userTvSeries[0].seasonWatchedCounts).toEqual({ 10: 1 });
  expect(await refreshSeriesWatchSummary(ctx, "user", 1, true)).toBe("unchanged");
});

test("backfill reports background work clearly and logs completion only after the last batch", async () => {
  const { ctx, tables, reads, scheduled } = context();
  for (const tvSeriesId of [1, 2]) {
    await ctx.db.insert("userTvSeries", {
      userId: "user", tvSeriesId, status: "on_hold", createdAt: 10, updatedAt: 20,
    });
  }
  await ctx.db.insert("userEpisodes", {
    userId: "user", tvSeriesId: 1, seasonId: 10, episodeId: 100, isWatched: true,
  });
  const log = spyOn(console, "info").mockImplementation(() => {});
  try {
    const first = await backfillSeasonWatchedCounts._handler(ctx, {});
    expect(first).toEqual({
      status: "running_in_background",
      message: expect.stringContaining("Convex function logs"),
    });
    expect(tables.userTvSeries[1].seasonWatchedCounts).toBeUndefined();
    expect(scheduled).toEqual([{ cursor: "1" }]);
    expect(log).not.toHaveBeenCalled();
    const last = await backfillSeasonWatchedCounts._handler(ctx, scheduled.shift());
    expect(last).toEqual({ status: "completed", message: "Season watched-count backfill completed." });
    expect(log.mock.calls).toEqual([[last.message]]);
    expect(scheduled).toEqual([]);
    expect(tables.userTvSeries.map(s => s.seasonWatchedCounts)).toEqual([{ 10: 1 }, {}]);
    expect(tables.userTvSeries.map(s => [s.createdAt, s.updatedAt])).toEqual([[10, 20], [10, 20]]);
    reads.length = 0;
    expect((await backfillSeasonWatchedCounts._handler(ctx, {})).status).toBe("running_in_background");
    expect(reads).toEqual(["userTvSeries"]);
  } finally {
    log.mockRestore();
  }
});

test("empty backfills report completion immediately without scheduling more work", async () => {
  const { ctx, scheduled } = context();
  const log = spyOn(console, "info").mockImplementation(() => {});
  try {
    expect((await backfillSeasonWatchedCounts._handler(ctx, {})).status).toBe("completed");
    expect(log.mock.calls).toEqual([["Season watched-count backfill completed."]]);
    expect(scheduled).toEqual([]);
  } finally {
    log.mockRestore();
  }
});

test("series cards use season IDs, distinguish unknown progress, and require a positive matching total", () => {
  const season = { id: 10, season_number: 1, name: "Season 1", air_date: null, poster_path: null, episode_count: 8 };
  const render = (counts, overrides = {}) => renderToStaticMarkup(
    <SeasonsSection seriesId={1} seasons={[{ ...season, ...overrides }]} seasonWatchedCounts={counts} />,
  );
  expect(render({ 10: 8 })).toContain('aria-label="All 8 episodes watched"');
  expect(render({ 10: 6 })).toContain("6/8 watched");
  expect(render({})).toContain("8 episodes");
  expect(render({})).not.toContain("0/8 watched");
  expect(render(undefined)).not.toContain("watched");
  expect(render({ 10: 0 }, { episode_count: 0 })).not.toContain("episodes watched");
  expect(render({ 10: 8 }, { episode_count: 9 })).toContain("8/9 watched");
  expect(render({ 10: 9 })).not.toContain('aria-label="All 8 episodes watched"');
});
