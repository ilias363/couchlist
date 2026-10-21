/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { STATS_BATCH_LIMITS, STATS_BATCH_SIZE, STATS_LEASE_MS } from "./stats";
import { DAY, emptyStats } from "./lib/statsModel";
import type { Doc, Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const NOW = Date.UTC(2026, 9, 21, 12);
function setup(overrides = {}) {
  const t = convexTest({ schema, modules, transactionLimits: {
    ...STATS_BATCH_LIMITS, documentsRead: 520, databaseQueries: 264, functionsScheduled: 2, ...overrides,
  } });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}
type Test = ReturnType<typeof setup>["t"];
type Client = ReturnType<typeof setup>["owner"];
const movie = (movieId: number, fields = {}) => ({ userId: "owner", movieId, status: "watched" as const, createdAt: 1, updatedAt: 1, ...fields });
const episode = (episodeId: number, fields = {}) => ({ userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true, createdAt: 1, updatedAt: 1, ...fields });
async function step(t: Test, jobId: Id<"statsRebuilds">) {
  const before = await t.run(ctx => ctx.db.get(jobId));
  expect(before).not.toBeNull();
  const metrics = await t.run(async ctx => {
    await ctx.runMutation(internal.stats.runBatch, { jobId, revision: before!.revision });
    return ctx.meta.getTransactionMetrics();
  });
  const job = await t.run(ctx => ctx.db.get(jobId));
  expect(job?.error).toBeUndefined();
  return { job: job!, metrics };
}
async function finish(t: Test, jobId: Id<"statsRebuilds">) {
  let maximumReads = 0, maximumQueries = 0, maximumWrites = 0, batches = 0;
  let maximumJobBytes = 0;
  for (; batches < 1000; batches++) {
    const { job, metrics } = await step(t, jobId);
    maximumReads = Math.max(maximumReads, metrics.documentsRead.used);
    maximumQueries = Math.max(maximumQueries, metrics.databaseQueries.used);
    maximumWrites = Math.max(maximumWrites, metrics.documentsWritten.used);
    maximumJobBytes = Math.max(maximumJobBytes, JSON.stringify(job).length);
    expect(job.stats.dailyActivity).toHaveLength(30);
    expect(job.stats.weeklyActivity).toHaveLength(12);
    expect(job.stats.weekdayDistribution).toHaveLength(7);
    expect(metrics.functionsScheduled.used).toBeLessThanOrEqual(1);
    expect(metrics.scheduledFunctionArgsBytes.used).toBeLessThan(1024);
    if (job.status === "complete") return { batches: batches + 1, maximumReads, maximumQueries, maximumWrites, maximumJobBytes };
  }
  throw new Error("Stats didn't finish within bounded iterations");
}
async function finishOperation(t: Test, owner: Client, jobId: Id<"dataOperations">) {
  for (let i = 0; i < 100; i++) {
    const job = await owner.query(api.dataOperations.status, { jobId });
    expect(job.error).toBeUndefined();
    if (job.phase === "complete" || job.phase === "awaiting_identity") return job;
    await t.mutation(internal.dataOperations.runBatch, { jobId, revision: job.revision });
  }
  throw new Error("Operation didn't finish");
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

test("cached reads use at most three indexed reads and cannot write/schedule, even on a miss", async () => {
  const { t, owner } = setup();
  const read = () => owner.run(ctx => ctx.runQuery(api.stats.getUserStats, {}, { transactionLimits: {
    documentsRead: 3, databaseQueries: 3, documentsWritten: 0, functionsScheduled: 0,
  } }));
  expect(await read()).toMatchObject({ stats: null, job: null, blocked: false });
  expect(await t.run(ctx => ctx.db.query("statsRebuilds").first())).toBeNull();
  await t.run(ctx => ctx.db.insert("userStats", { userId: "owner", stats: emptyStats(NOW), lastRefreshed: NOW }));
  expect((await read()).stats?.generatedAt).toBe(NOW);
  expect(await owner.mutation(api.stats.ensureStats, {})).toBeNull();
  vi.setSystemTime(NOW + DAY);
  // A stale query still does no history work. Only an explicit trigger does.
  expect((await read()).stats?.generatedAt).toBe(NOW);
  const jobId = await owner.mutation(api.stats.ensureStats, {});
  expect(jobId).not.toBeNull();
  expect((await read()).job?.status).toBe("running");
  await finish(t, jobId!);
  expect((await read()).lastRefreshed).toBe(NOW + DAY);
});

test("manual refresh bypasses TTL; repeated/parallel tab triggers deduplicate and scheduled work completes", async () => {
  const { t, owner } = setup();
  await t.run(ctx => ctx.db.insert("userStats", { userId: "owner", stats: emptyStats(NOW), lastRefreshed: NOW }));
  const ids = await Promise.all(Array.from({ length: 6 }, () => owner.mutation(api.stats.refreshStats, {})));
  expect(new Set(ids).size).toBe(1);
  expect(await owner.mutation(api.stats.ensureStats, {})).toBe(ids[0]);
  expect(await t.run(ctx => ctx.db.query("statsRebuilds").take(2))).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect((await owner.query(api.stats.getUserStats, {})).job?.status).toBe("complete");
});

test("authentication is required, extra identity/job args are rejected and other owners see only their jobs", async () => {
  const { t, owner, other } = setup();
  await expect(t.query(api.stats.getUserStats, {})).rejects.toThrow(/Unauthorized/);
  await expect(t.mutation(api.stats.ensureStats, {})).rejects.toThrow(/Unauthorized/);
  await expect(t.mutation(api.stats.refreshStats, {})).rejects.toThrow(/Unauthorized/);
  const id = await owner.mutation(api.stats.ensureStats, {});
  expect((await other.query(api.stats.getUserStats, {})).job).toBeNull();
  await expect(other.query(api.stats.getUserStats, { jobId: id } as never)).rejects.toThrow();
  await expect(other.mutation(api.stats.refreshStats, { userId: "owner" } as never)).rejects.toThrow();
  const otherId = await other.mutation(api.stats.refreshStats, {});
  expect(otherId).not.toBe(id);
  await finish(t, otherId!);
  expect((await owner.query(api.stats.getUserStats, {})).stats).toBeNull();
});

// Separate the array-limit history from the object-limit key cardinality.
// convex-test emulates indexed point reads by scanning its in-memory table;
// combining both dimensions needlessly makes this test quadratic in fixtures.
test.each([{ size: 8301, distinct: 1 }, { size: 1030, distinct: 1030 }])("$size episodes / $distinct distinct days and seasons obey enforced budgets and fixed state", async ({ size, distinct }) => {
  const { t, owner } = setup();
  for (let start = 0; start < size; start += 128) await t.run(async ctx => {
    for (let i = start; i < Math.min(start + 128, size); i++) await ctx.db.insert("userEpisodes", episode(i, { seasonId: i % distinct, watchedDate: NOW - (i % distinct) * DAY, runtime: 20 }));
  });
  // Negative controls prove this harness rejects both read and query overruns.
  await expect(t.run(async ctx => {
    await ctx.db.query("userEpisodes").withIndex("by_user_watched", q => q.eq("userId", "owner").eq("isWatched", true)).collect();
  })).rejects.toThrow(/too many documents/);
  await expect(t.run(async ctx => {
    for (let i = 0; i < 265; i++) await ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", "owner")).first();
  })).rejects.toThrow(/index ranges/);
  const jobId = await owner.mutation(api.stats.ensureStats, {});
  const evidence = await finish(t, jobId!);
  expect(evidence.batches).toBeGreaterThan(Math.ceil(size / STATS_BATCH_SIZE) + 2);
  expect(evidence.maximumReads).toBeLessThanOrEqual(200);
  expect(evidence.maximumQueries).toBeLessThanOrEqual(140);
  expect(evidence.maximumWrites).toBeLessThanOrEqual(130);
  expect(evidence.maximumJobBytes).toBeLessThan(16_384);
  const { stats } = await owner.query(api.stats.getUserStats, {});
  expect(stats?.overview).toMatchObject({ totalWatchedEpisodes: size, totalWatchedSeasons: distinct, totalWatchTimeMinutes: size * 20, totalWatchTimeHours: Math.round(size * 20 / 60) });
  expect(stats?.streaks).toEqual({ current: distinct, longest: distinct });
  expect(stats?.recentActivity.episodesWatched).toBe(distinct === 1 ? size : 30);
  expect(await t.run(ctx => ctx.db.query("statsFacts").first())).toBeNull();
  console.info("stats enforced-budget evidence", { size, distinct, ...evidence });
}, 900000);

test("all metrics retain existing meanings for statuses, unknown dates and exact window boundaries", async () => {
  const { t, owner } = setup();
  const today = Math.floor(NOW / DAY) * DAY;
  await t.run(async ctx => {
    const movies = [
      movie(1, { watchedDate: NOW, runtime: 120 }), movie(2, { runtime: 90 }),
      movie(3, { status: "want_to_watch" }), movie(4, { status: "on_hold", watchedDate: NOW - DAY, runtime: 500 }),
      movie(5, { status: "dropped", watchedDate: NOW - 30 * DAY }),
      movie(6, { watchedDate: NOW - 7 * DAY, runtime: 60 }),
      movie(7, { watchedDate: today - 29 * DAY, runtime: 30 }), movie(8, { watchedDate: NOW - 84 * DAY }),
    ];
    for (const row of movies) await ctx.db.insert("userMovies", row as Doc<"userMovies">);
    for (const [i, status] of ["watched", "up_to_date", "currently_watching", "want_to_watch", "on_hold", "dropped"].entries()) await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: i, status: status as Doc<"userTvSeries">["status"], createdAt: 1, updatedAt: 1 });
    for (const row of [
      episode(1, { watchedDate: NOW, runtime: 45 }), episode(2, { watchedDate: NOW - DAY, runtime: 50 }),
      episode(3, { watchedDate: NOW - DAY, runtime: 25 }), episode(4, { seasonId: 11, runtime: 40 }),
      episode(5, { seasonId: 11, watchedDate: NOW - 30 * DAY }), episode(6, { seasonId: 99, isWatched: false, watchedDate: NOW, runtime: 1000 }),
      episode(7, { seasonId: 12, watchedDate: NOW - 7 * DAY }), episode(8, { watchedDate: 0 }),
    ]) await ctx.db.insert("userEpisodes", row);
    await ctx.db.insert("userMovies", movie(999, { userId: "other", watchedDate: NOW, runtime: 9999 }));
  });
  const id = await owner.mutation(api.stats.ensureStats, {});
  await step(t, id!); vi.setSystemTime(NOW + 3 * DAY); // Windows stay at original reference time.
  await finish(t, id!);
  const stats = (await owner.query(api.stats.getUserStats, {})).stats!;
  expect(stats.generatedAt).toBe(NOW);
  expect(stats.movies).toEqual({ total: 8, watched: 5, wantToWatch: 1, onHold: 1, dropped: 1 });
  expect(stats.tvSeries).toEqual({ total: 6, watched: 1, currentlyWatching: 1, upToDate: 1, wantToWatch: 1, onHold: 1, dropped: 1 });
  expect(stats.episodes).toEqual({ totalWatchedEpisodes: 7, totalWatchedSeasons: 3 });
  expect(stats.overview).toEqual({ totalStartedMovies: 7, totalStartedTvSeries: 5, totalWatchedMovies: 5, totalWatchedTvSeries: 2, totalWatchedEpisodes: 7, totalWatchedSeasons: 3, totalWatchTimeMinutes: 460, totalWatchTimeHours: 8 });
  expect(stats.watchTimeBreakdown).toEqual({ moviesMinutes: 300, episodesMinutes: 160, totalMinutes: 460 });
  expect(stats.completionRates).toEqual({ movies: 5 / 7, tvSeries: 2 / 5 });
  expect(stats.recentActivity).toEqual({ moviesWatched: 4, episodesWatched: 4, totalItems: 8 });
  expect(stats.dailyActivity[0]).toEqual({ date: "2026-09-22", movies: 1, episodes: 0, total: 1 });
  expect(stats.dailyActivity.at(-1)).toEqual({ date: "2026-10-21", movies: 1, episodes: 1, total: 2 });
  expect(stats.dailyActivity[28]).toEqual({ date: "2026-10-20", movies: 0, episodes: 2, total: 2 });
  expect(stats.weeklyActivity[10]).toMatchObject({ start: NOW - 14 * DAY, end: NOW - 7 * DAY, movies: 1, episodes: 1 });
  expect(stats.weeklyActivity[11]).toMatchObject({ start: NOW - 7 * DAY, end: NOW, movies: 1, episodes: 3 });
  expect(stats.weeklyActivity.reduce((n, w) => n + w.movies, 0)).toBe(3); // 84-day start is exclusive.
  expect(stats.weekdayDistribution[3]).toEqual({ weekday: 3, movies: 3, episodes: 2, total: 5 });
  expect(stats.streaks).toEqual({ current: 2, longest: 2 });
  expect(stats.distributions.movies.map(d => d.value)).toEqual([5, 1, 1, 1]);
  expect(stats.distributions.tvSeries.map(d => d.value)).toEqual([1, 1, 1, 1, 1, 1]);
});

test("large TV summary documents yield byte-limited short pages without dropping records", async () => {
  const { t, owner } = setup();
  const counts = Object.fromEntries(Array.from({ length: 1024 }, (_, i) => [String(i), i]));
  const proofs = Object.fromEntries(Array.from({ length: 1024 }, (_, i) => [String(i), { episodeCount: 100, airDate: "2026-10-21", watchedCount: 100 }]));
  for (let i = 0; i < 16; i++) await t.run(ctx => ctx.db.insert("userTvSeries", {
    userId: "owner", tvSeriesId: i, status: "watched", createdAt: 1, updatedAt: 1,
    seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs,
  }));
  const id = (await owner.mutation(api.stats.ensureStats, {}))!;
  await step(t, id); // Empty movies pass.
  const { job } = await step(t, id);
  expect(job.processed).toBeGreaterThan(0);
  expect(job.processed).toBeLessThan(16);
  expect(job.phase).toBe("tv");
  await finish(t, id);
  expect((await owner.query(api.stats.getUserStats, {})).stats?.tvSeries.watched).toBe(16);
});

test.each([[], [-10, -9, -8, -5, -4, -3], [-4, -3, -2, -1], [-3, -2, -1, 0]].map(offsets => ({ offsets })))("streak gaps/ties/current ending and empty histories: $offsets", async ({ offsets }) => {
  const { t, owner } = setup();
  await t.run(async ctx => {
    for (const [i, offset] of offsets.entries()) {
      await ctx.db.insert("userMovies", movie(i, { watchedDate: NOW + offset * DAY }));
      await ctx.db.insert("userEpisodes", episode(i, { watchedDate: NOW + offset * DAY }));
    }
  });
  const id = await owner.mutation(api.stats.ensureStats, {}); await finish(t, id!);
  const stats = (await owner.query(api.stats.getUserStats, {})).stats!;
  const longest = offsets.length === 6 ? 3 : offsets.length;
  expect(stats.streaks).toEqual({ current: offsets.length === 6 ? 0 : offsets.length, longest });
  if (!offsets.length) {
    expect(stats.overview.totalWatchTimeMinutes).toBe(0);
    expect(stats.completionRates).toEqual({ movies: 100, tvSeries: 100 }); // Legacy empty-history convention.
    expect(stats.dailyActivity.every(d => d.total === 0)).toBe(true);
  }
});

test("failed batches roll back, keep the prior snapshot and resume exactly; lost callbacks can be retried", async () => {
  const { t, owner } = setup();
  await t.run(ctx => ctx.db.insert("userStats", { userId: "owner", stats: emptyStats(NOW - DAY), lastRefreshed: NOW - DAY }));
  await t.run(async ctx => { for (let i = 0; i < 130; i++) await ctx.db.insert("userMovies", movie(i, { watchedDate: NOW - i * DAY })); });
  const id = (await owner.mutation(api.stats.ensureStats, {}))!;
  await step(t, id);
  const checkpoint = (await t.run(ctx => ctx.db.get(id)))!;
  expect(checkpoint.processed).toBe(STATS_BATCH_SIZE);
  // Force a real mid-page database error after earlier rows have written facts.
  // The nested transaction must roll all of them back before recording failure.
  const duplicates = await t.run(async ctx => {
    const value = { userId: "owner", jobId: id, kind: "day" as const, key: Math.floor((NOW - 100 * DAY) / DAY) * DAY };
    return [await ctx.db.insert("statsFacts", value), await ctx.db.insert("statsFacts", value)];
  });
  await t.mutation(internal.stats.runBatch, { jobId: id, revision: checkpoint.revision });
  let state = await owner.query(api.stats.getUserStats, {});
  expect(state.job?.status).toBe("failed");
  expect(state.job?.processed).toBe(64);
  expect(state.stats?.generatedAt).toBe(NOW - DAY);
  expect(await t.run(ctx => ctx.db.query("statsFacts").withIndex("by_job_kind_key", q => q.eq("jobId", id).eq("kind", "day").eq("key", Math.floor((NOW - 64 * DAY) / DAY) * DAY)).first())).toBeNull();
  await t.run(async ctx => { for (const duplicate of duplicates) await ctx.db.delete(duplicate); });
  expect(await owner.mutation(api.stats.ensureStats, {})).toBe(id); // No automatic retry storm.
  expect((await owner.query(api.stats.getUserStats, {})).job?.status).toBe("failed");
  expect(await owner.mutation(api.stats.refreshStats, {})).toBe(id);
  await t.mutation(internal.stats.runBatch, { jobId: id, revision: checkpoint.revision });
  expect((await owner.query(api.stats.getUserStats, {})).job?.processed).toBe(64);
  vi.setSystemTime(NOW + STATS_LEASE_MS);
  await owner.mutation(api.stats.refreshStats, {});
  await finish(t, id);
  state = await owner.query(api.stats.getUserStats, {});
  expect(state.stats?.movies.watched).toBe(130);
  expect(state.stats?.generatedAt).toBe(NOW);
  expect(state.job?.status).toBe("complete");
});

test("normal watch edits restart a mixed pass before publication; stale revisions/jobs cannot overwrite newer stats", async () => {
  const { t, owner } = setup();
  await t.run(async ctx => { for (let i = 0; i < 130; i++) await ctx.db.insert("userMovies", movie(i, { watchedDate: NOW - DAY })); });
  const id = (await owner.mutation(api.stats.ensureStats, {}))!;
  await step(t, id);
  vi.setSystemTime(NOW + 1000);
  await owner.mutation(api.movie.setMovieStatus, { movieId: 1, status: "dropped" });
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 1, episodeId: 1, isWatched: true, runtime: 30, watchedAt: NOW });
  await finish(t, id);
  let state = await owner.query(api.stats.getUserStats, {});
  expect(state.job?.restarts).toBe(1);
  expect(state.stats?.movies).toMatchObject({ watched: 129, dropped: 1 });
  expect(state.stats?.episodes.totalWatchedEpisodes).toBe(1);
  expect(state.stats?.generatedAt).toBe(NOW + 1000);
  vi.setSystemTime(NOW + 2000);
  const newer = (await owner.mutation(api.stats.refreshStats, {}))!;
  expect(newer).not.toBe(id);
  await finish(t, newer);
  await t.mutation(internal.stats.runBatch, { jobId: id, revision: 0 });
  await t.mutation(internal.stats.processBatch, { jobId: id, revision: 999 });
  state = await owner.query(api.stats.getUserStats, {});
  expect(state.stats?.generatedAt).toBe(NOW + 2000);
});

test("an edit after the final history scan still fences publication", async () => {
  const { t, owner } = setup();
  await owner.mutation(api.movie.setMovieStatus, { movieId: 1, status: "watched", watchedAt: NOW });
  const id = (await owner.mutation(api.stats.ensureStats, {}))!;
  for (let i = 0; i < 10; i++) {
    const { job } = await step(t, id);
    if (job.phase === "cleanup") break;
  }
  expect((await t.run(ctx => ctx.db.get(id)))?.phase).toBe("cleanup");
  expect((await owner.query(api.stats.getUserStats, {})).stats).toBeNull();
  await owner.mutation(api.movie.deleteMovie, { movieId: 1 });
  await finish(t, id);
  const result = await owner.query(api.stats.getUserStats, {});
  expect(result.job?.restarts).toBe(1);
  expect(result.stats?.movies.total).toBe(0);
  expect(result.stats?.streaks).toEqual({ current: 0, longest: 0 });
});

test.each(["merge", "replace", "clear_movies", "clear_tv", "account"] as const)("%s fences stats work, removes scratch and prevents old callbacks from resurrecting data", async kind => {
  const { t, owner, other } = setup();
  await t.run(async ctx => {
    await ctx.db.insert("userStats", { userId: "owner", stats: emptyStats(NOW - DAY), lastRefreshed: NOW - DAY });
    await ctx.db.insert("userStats", { userId: "other", stats: emptyStats(NOW), lastRefreshed: NOW });
    for (let i = 0; i < 130; i++) await ctx.db.insert("userMovies", movie(i, { watchedDate: NOW - i * DAY }));
  });
  const id = (await owner.mutation(api.stats.ensureStats, {}))!;
  await step(t, id);
  let operation: Id<"dataOperations">;
  if (kind === "merge" || kind === "replace") {
    operation = await owner.mutation(api.importExport.startImport, { schema: "couchlist.export", version: 1, mode: kind, fingerprint: "a".repeat(64), expected: { movies: 1, tvSeries: 0, episodes: 0 } });
    await owner.mutation(api.importExport.stageImport, { jobId: operation, offset: 0, rows: [{ kind: "movies", value: { movieId: 999, status: "on_hold" } }] });
    await owner.mutation(api.importExport.sealImport, { jobId: operation });
  } else operation = await owner.mutation(kind === "account" ? api.account.deleteAccountData : kind === "clear_tv" ? api.tv.clearAllTvData : api.movie.clearAllMovies, {});
  expect((await owner.query(api.stats.getUserStats, {})).blocked).toBe(true);
  await expect(owner.mutation(api.stats.refreshStats, {})).rejects.toThrow(/data operation/);
  await expect(owner.mutation(api.movie.setMovieStatus, { movieId: 999, status: "watched" })).rejects.toThrow(/data operation/);
  await t.mutation(internal.stats.runBatch, { jobId: id, revision: 1 });
  await finishOperation(t, owner, operation);
  await t.mutation(internal.stats.runBatch, { jobId: id, revision: 1 });
  await t.mutation(internal.stats.cleanupFacts, { jobId: id });
  expect(await t.run(ctx => ctx.db.get(id))).toBeNull();
  expect(await t.run(ctx => ctx.db.query("statsFacts").withIndex("by_user", q => q.eq("userId", "owner")).first())).toBeNull();
  expect((await owner.query(api.stats.getUserStats, {})).stats).toBeNull();
  expect((await other.query(api.stats.getUserStats, {})).stats?.generatedAt).toBe(NOW);
  if (kind === "account") {
    await expect(owner.mutation(api.stats.ensureStats, {})).rejects.toThrow(/data operation/);
  } else {
    const next = (await owner.mutation(api.stats.ensureStats, {}))!;
    await finish(t, next);
    const count = (await owner.query(api.stats.getUserStats, {})).stats!.movies.total;
    expect(count).toBe(kind === "replace" ? 1 : kind === "merge" ? 131 : kind === "clear_tv" ? 130 : 0);
  }
});
