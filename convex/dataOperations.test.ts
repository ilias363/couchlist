/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { BATCH_SIZE, parseBackup, type BackupRow } from "./lib/backupFormat";
import { downloadBackup } from "../lib/data-operations-client";
import type { ConvexReactClient } from "convex/react";
import type { FunctionArgs } from "convex/server";

const modules = import.meta.glob("./**/*.ts");
function setup() {
  // Deliberately tighter than production; unlike the audit's mock these limits
  // enforce index ranges, documents and bytes in every transaction/savepoint.
  const t = convexTest({ schema, modules, transactionLimits: {
    databaseQueries: 512, documentsRead: 1500, documentsWritten: 512,
    bytesRead: 4 * 1024 * 1024, bytesWritten: 4 * 1024 * 1024,
  } });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}
type Client = ReturnType<typeof setup>["owner"];
const fingerprint = "a".repeat(64);
const episode = (id: number, fields = {}) => ({ kind: "episodes", value: { tvSeriesId: 1, seasonId: 10, episodeId: id, isWatched: true, ...fields } }) as BackupRow;
const movie = (id: number) => ({ kind: "movies", value: { movieId: id, status: "watched" } }) as BackupRow;
async function prepare(owner: Client, rows: BackupRow[], mode: "merge" | "replace" = "merge", chunk = BATCH_SIZE) {
  const expected = { movies: 0, tvSeries: 0, episodes: 0 };
  for (const row of rows) expected[row.kind]++;
  const jobId = await owner.mutation(api.importExport.startImport, { schema: "couchlist.export", version: 1, mode, fingerprint, expected });
  for (let offset = 0; offset < rows.length; offset += chunk) await owner.mutation(api.importExport.stageImport, { jobId, offset, rows: rows.slice(offset, offset + chunk) });
  return jobId;
}
async function step(t: ReturnType<typeof setup>["t"], owner: Client, jobId: Id<"dataOperations">) {
  const before = await owner.query(api.dataOperations.status, { jobId });
  await t.mutation(internal.dataOperations.runBatch, { jobId, revision: before.revision });
  return owner.query(api.dataOperations.status, { jobId });
}
async function finish(t: ReturnType<typeof setup>["t"], owner: Client, jobId: Id<"dataOperations">) {
  for (let i = 0; i < 1000; i++) {
    const job = await step(t, owner, jobId);
    expect(job.error).toBeUndefined();
    if (job.phase === "complete" || job.phase === "awaiting_identity") return job;
  }
  throw new Error("Job did not finish within bounded test iterations");
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

test("the test harness enforces transaction budgets", async () => {
  const { t } = setup();
  await expect(t.run(async ctx => {
    for (let i = 0; i < 513; i++) await ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", "owner")).first();
  })).rejects.toThrow(/index ranges/);
});

test("4097-record imports stay below enforced transaction limits", async () => {
  const { t, owner } = setup();
  const rows = Array.from({ length: 4097 }, (_, i) => movie(i + 1));
  const jobId = await prepare(owner, rows);
  await owner.mutation(api.importExport.sealImport, { jobId });
  const done = await finish(t, owner, jobId);
  expect(done.inserted.movies).toBe(4097);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 4097 })).not.toBeNull();
}, 900000);

test("8301-episode downloadable exports stay bounded and round-trip version 1", async () => {
  const { t, owner } = setup();
  for (let start = 1; start <= 8301; start += 400) await t.run(async ctx => {
    for (let i = start; i < Math.min(start + 400, 8302); i++) await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: i, isWatched: true, createdAt: 1, updatedAt: 1 });
  });
  await t.run(ctx => ctx.db.insert("userEpisodes", { userId: "other", tvSeriesId: 1, seasonId: 10, episodeId: 99999, isWatched: true, createdAt: 1, updatedAt: 1 }));
  const client = { mutation: owner.mutation, query: async (ref: typeof api.importExport.exportData, args: FunctionArgs<typeof api.importExport.exportData>) => {
    const result = await owner.query(ref, args);
    expect(result.page.length).toBeLessThanOrEqual(100);
    return result;
  } } as unknown as ConvexReactClient;
  const blob = await downloadBackup(client, () => {});
  const backup = parseBackup(JSON.parse(await blob.text()));
  expect(backup.episodes).toHaveLength(8301);
  expect(new Set(backup.episodes.map(e => e.episodeId)).size).toBe(8301);
}, 120000);

test("replacement validates the entire staged file, retries exactly, and recovers without the file", async () => {
  const { t, owner } = setup();
  await owner.mutation(api.movie.setMovieStatus, { movieId: 999, status: "on_hold", runtime: 90 });
  const rows = [movie(1), movie(2), ...Array.from({ length: 205 }, (_, i) => episode(i + 1))];
  const jobId = await owner.mutation(api.importExport.startImport, { schema: "couchlist.export", version: 1, mode: "replace", fingerprint, expected: { movies: 2, tvSeries: 0, episodes: 205 } });
  await owner.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: rows.slice(0, 2) });
  await owner.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: rows.slice(0, 2) });
  await expect(owner.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: [movie(123)] })).rejects.toThrow(/differs/);
  await expect(owner.mutation(api.importExport.stageImport, { jobId, offset: 2, rows: [episode(-1)] })).rejects.toThrow(/Invalid/);
  await expect(owner.mutation(api.importExport.sealImport, { jobId })).rejects.toThrow(/full backup/);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 999 })).not.toBeNull();
  // Reopening the same file retrieves the upload checkpoint, not a new job.
  expect(await owner.mutation(api.importExport.startImport, { schema: "couchlist.export", version: 1, mode: "replace", fingerprint, expected: { movies: 2, tvSeries: 0, episodes: 205 } })).toBe(jobId);
  for (let offset = 2; offset < rows.length; offset += 100) await owner.mutation(api.importExport.stageImport, { jobId, offset, rows: rows.slice(offset, offset + 100) });
  await owner.mutation(api.importExport.sealImport, { jobId });
  const checkpoint = await step(t, owner, jobId);
  expect(checkpoint.position).toBe(99);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 999 })).not.toBeNull();
  await t.mutation(internal.dataOperations.runBatch, { jobId, revision: checkpoint.revision - 1 });
  expect((await owner.query(api.dataOperations.status, { jobId })).position).toBe(99);
  await owner.mutation(api.dataOperations.resume, { jobId });
  await owner.mutation(api.dataOperations.resume, { jobId });
  const done = await finish(t, owner, jobId);
  expect(done.inserted).toEqual({ movies: 2, tvSeries: 0, episodes: 205 });
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 999 })).toBeNull();
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.seasonWatchedCounts).toEqual({ 10: 205 });
  expect(await t.run(ctx => ctx.db.query("dataImportRows").first())).toBeNull();
});

test("invalid JSON/version/duplicates are rejected before replacement; late duplicate upload rolls back", async () => {
  const { t, owner } = setup();
  await owner.mutation(api.movie.setMovieStatus, { movieId: 8, status: "watched" });
  for (const input of [null, { schema: "couchlist.export", version: 2 }, { schema: "couchlist.export", version: 1, movies: null }, { schema: "couchlist.export", version: 1, movies: [movie(1).value, movie(1).value] }, { schema: "couchlist.export", version: 1, episodes: [episode(1, { watchedDate: null }).value] }]) expect(() => parseBackup(input)).toThrow();
  const jobId = await owner.mutation(api.importExport.startImport, { schema: "couchlist.export", version: 1, mode: "replace", fingerprint, expected: { movies: 3, tvSeries: 0, episodes: 0 } });
  await owner.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: [movie(1)] });
  await expect(owner.mutation(api.importExport.stageImport, { jobId, offset: 1, rows: [movie(2), movie(1)] })).rejects.toThrow(/Duplicate/);
  expect((await owner.query(api.dataOperations.status, { jobId })).uploaded.movies).toBe(1);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 8 })).not.toBeNull();
  await owner.mutation(api.dataOperations.cancelPreparation, { jobId });
  await finish(t, owner, jobId);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 8 })).not.toBeNull();
});

test("merge preserves unknown dates/runtime, clears unwatched dates and repairs moved parents across summary batches", async () => {
  const { t, owner } = setup();
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: 200, runtime: 50 });
  await owner.mutation(api.tv.setSeriesStatus, { tvSeriesId: 1, status: "on_hold" });
  const original = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
  await owner.mutation(api.movie.setMovieStatus, { movieId: 77, status: "watched", watchedAt: 123, runtime: 120 });
  vi.setSystemTime(Date.now() + 1000);
  let jobId = await prepare(owner, [movie(77), episode(1, { tvSeriesId: 2, seasonId: 20 }), ...Array.from({ length: 204 }, (_, i) => episode(i + 2, { tvSeriesId: 2, seasonId: i % 2 ? 20 : 30, ...(i === 10 ? { watchedDate: 50 } : {}) }))]);
  await owner.mutation(api.importExport.sealImport, { jobId });
  await finish(t, owner, jobId);
  const old = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
  expect(old?.seasonWatchedCounts).toEqual({});
  expect([old?.startedAt, old?.lastWatchedAt, old?.status, old?.updatedAt]).toEqual([undefined, undefined, "on_hold", original?.updatedAt]);
  const moved = await t.run(ctx => ctx.db.query("userEpisodes").withIndex("by_user_episode", q => q.eq("userId", "owner").eq("episodeId", 1)).unique());
  expect([moved?.watchedDate, moved?.runtime]).toEqual([200, 50]);
  const target = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 });
  expect([target?.startedAt, target?.lastWatchedAt]).toEqual([50, 200]);
  expect(target?.seasonWatchedCounts).toEqual({ 20: 103, 30: 102 });
  expect(target?.watchSummaryVersion).toBe(1);
  // Finalization must leave both moved parents ready for incremental writes.
  // No repair/rebuild is allowed on the next ordinary mutation.
  await owner.run(async ctx => {
    await ctx.runMutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 2, seasonId: 20, episodeId: 1, isWatched: true, watchedAt: -10 }, {
      transactionLimits: { documentsRead: 8, databaseQueries: 8 },
    });
  });
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).toMatchObject({ startedAt: -10, lastWatchedAt: 50, seasonWatchedCounts: { 20: 103, 30: 102 } });
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 9999, isWatched: true, watchedAt: 0 });
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ startedAt: 0, lastWatchedAt: 0, seasonWatchedCounts: { 10: 1 }, status: "on_hold" });
  const mergedMovie = await owner.query(api.movie.getMovieStatus, { movieId: 77 });
  expect([mergedMovie?.watchedDate, mergedMovie?.runtime]).toEqual([123, 120]);
  jobId = await prepare(owner, [episode(1, { tvSeriesId: 2, seasonId: 20, isWatched: false })]);
  await owner.mutation(api.importExport.sealImport, { jobId }); await finish(t, owner, jobId);
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 }))?.lastWatchedAt).toBe(50);
  jobId = await prepare(owner, [movie(77)], "replace");
  await owner.mutation(api.importExport.sealImport, { jobId }); await finish(t, owner, jobId);
  const replacedMovie = await owner.query(api.movie.getMovieStatus, { movieId: 77 });
  expect([replacedMovie?.watchedDate, replacedMovie?.runtime]).toEqual([undefined, undefined]);
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 2, seasonId: 20, episodeId: 1, isWatched: true, watchedAt: 0 });
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).toMatchObject({ startedAt: 0, lastWatchedAt: 0, seasonWatchedCounts: { 20: 1 } });
});

test.each(["individual", "bulk"])("unwatched-only imports remain editable through %s writes after orphan repair", async mode => {
  const { t, owner } = setup();
  const jobId = await prepare(owner, Array.from({ length: 205 }, (_, i) => episode(i + 1, { isWatched: false, watchedDate: -10 })));
  await owner.mutation(api.importExport.sealImport, { jobId });
  await finish(t, owner, jobId);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toBeNull();
  const repairId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  await finish(t, owner, repairId);

  // The watched index must skip all 205 unwatched rows, not scan through them.
  const write = () => owner.run(async ctx => {
    const budget = { transactionLimits: { documentsRead: 8, databaseQueries: 8 } };
    if (mode === "individual") await ctx.runMutation(api.tv.toggleEpisodeWatched, {
      tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: 0,
    }, budget);
    else await ctx.runMutation(api.tv.bulkToggleSeasonEpisodes, {
      tvSeriesId: 1, seasonId: 10, episodesInfo: [{ episodeId: 1 }], isWatched: true, watchedAt: 0,
    }, budget);
  });
  await write();
  await write();
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({
    startedAt: 0, lastWatchedAt: 0, seasonWatchedCounts: { 10: 1 }, watchSummaryVersion: 1,
  });
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: false });
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ seasonWatchedCounts: {} });
});

test("all public job endpoints are owner-scoped; operations fence overlaps and normal writes", async () => {
  const { t, owner, other } = setup();
  const jobId = await prepare(owner, [episode(1)]);
  for (const ref of [api.dataOperations.status]) await expect(other.query(ref, { jobId })).rejects.toThrow(/not found/);
  for (const ref of [api.dataOperations.resume, api.dataOperations.cancelPreparation, api.importExport.sealImport, api.importExport.finishExport]) await expect(other.mutation(ref, { jobId })).rejects.toThrow(/not found/);
  await expect(other.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: [movie(1)] })).rejects.toThrow(/not found/);
  await expect(other.query(api.importExport.exportData, { jobId, kind: "movies", paginationOpts: { cursor: null, numItems: 1, maximumRowsRead: 1, maximumBytesRead: 1024 } })).rejects.toThrow(/not found/);
  await expect(t.query(api.dataOperations.status, { jobId })).rejects.toThrow(/Unauthorized/);
  await expect(t.mutation(api.importExport.startExport, {})).rejects.toThrow(/Unauthorized/);
  expect(await other.query(api.dataOperations.current, {})).toBeNull();
  await expect(owner.mutation(api.movie.setMovieStatus, { movieId: 1, status: "watched" })).rejects.toThrow(/operation/);
  await expect(owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 5, isWatched: true })).rejects.toThrow(/operation/);
  await expect(owner.mutation(api.stats.refreshStats, {})).rejects.toThrow(/operation/);
  await expect(owner.mutation(api.movie.clearAllMovies, {})).rejects.toThrow(/Another/);
  await expect(owner.mutation(api.account.deleteAccountData, {})).rejects.toThrow(/Another/);
  await owner.mutation(api.importExport.sealImport, { jobId });
  await expect(owner.mutation(api.dataOperations.cancelPreparation, { jobId })).rejects.toThrow(/Resume/);
  await finish(t, owner, jobId);
  await owner.mutation(api.movie.setMovieStatus, { movieId: 1, status: "watched" });
  expect((await other.query(api.movie.getMovieStatus, { movieId: 1 }))).toBeNull();
});

test("clear, series delete and account cleanup complete in batches and leave a deletion fence", async () => {
  const { t, owner, other } = setup();
  let jobId = await prepare(owner, [...Array.from({ length: 201 }, (_, i) => movie(i + 1)), ...Array.from({ length: 201 }, (_, i) => episode(i + 1)), episode(999, { tvSeriesId: 2, seasonId: 20 })]);
  await owner.mutation(api.importExport.sealImport, { jobId }); await finish(t, owner, jobId);
  await other.mutation(api.movie.setMovieStatus, { movieId: 1, status: "watched" });
  jobId = await owner.mutation(api.movie.clearAllMovies, {});
  expect(await owner.mutation(api.movie.clearAllMovies, {})).toBe(jobId);
  expect((await step(t, owner, jobId)).phase).toBe("delete_movies");
  await finish(t, owner, jobId);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 201 })).toBeNull();
  expect(await other.query(api.movie.getMovieStatus, { movieId: 1 })).not.toBeNull();
  jobId = await owner.mutation(api.tv.deleteTvSeries, { tvSeriesId: 1 });
  await step(t, owner, jobId);
  await owner.mutation(api.dataOperations.resume, { jobId });
  await finish(t, owner, jobId);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toBeNull();
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).not.toBeNull();
  jobId = await owner.mutation(api.tv.clearAllTvData, {}); await finish(t, owner, jobId);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).toBeNull();
  await t.run(async ctx => {
    for (let i = 0; i < 4; i++) await ctx.db.insert("userStats", { userId: "owner", stats: { large: "x".repeat(700000) }, lastRefreshed: 1 });
  });
  await owner.mutation(api.movie.setMovieStatus, { movieId: 3, status: "watched" });
  jobId = await owner.mutation(api.account.deleteAccountData, {});
  const done = await finish(t, owner, jobId);
  expect(done.phase).toBe("awaiting_identity");
  expect(await owner.mutation(api.account.deleteAccountData, {})).toBe(jobId);
  expect(await t.run(ctx => ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", "owner")).first())).toBeNull();
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 3 })).toBeNull();
  await expect(owner.mutation(api.movie.setMovieStatus, { movieId: 2, status: "watched" })).rejects.toThrow(/operation/);
});

test("scheduled continuations complete independently and expired preparations never change live data", async () => {
  const { t, owner } = setup();
  const jobId = await prepare(owner, [episode(1)]);
  await owner.mutation(api.importExport.sealImport, { jobId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 100);
  expect((await owner.query(api.dataOperations.status, { jobId })).phase).toBe("complete");
  const exportId = await owner.mutation(api.importExport.startExport, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 100);
  expect((await owner.query(api.dataOperations.status, { jobId: exportId })).phase).toBe("complete");
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).not.toBeNull();
});

test("a failed batch rolls back its writes and resumes from the durable checkpoint", async () => {
  const { t, owner } = setup();
  const duplicate = await t.run(async ctx => {
    const doc = { userId: "owner", movieId: 2, status: "on_hold" as const, runtime: 90, createdAt: 1, updatedAt: 1 };
    await ctx.db.insert("userMovies", doc);
    return ctx.db.insert("userMovies", doc);
  });
  const jobId = await prepare(owner, [movie(1), movie(2)]);
  await owner.mutation(api.importExport.sealImport, { jobId });
  const failed = await step(t, owner, jobId);
  expect(failed.error).toBeDefined();
  expect(failed.position).toBe(-1);
  expect(failed.inserted.movies).toBe(0);
  expect(await owner.query(api.movie.getMovieStatus, { movieId: 1 })).toBeNull();
  await t.run(ctx => ctx.db.delete(duplicate));
  await owner.mutation(api.dataOperations.resume, { jobId });
  await finish(t, owner, jobId);
  expect((await owner.query(api.movie.getMovieStatus, { movieId: 2 }))?.runtime).toBe(90);
});

test("imports resume summary reset cursors created before the incremental rollout", async () => {
  const { t, owner } = setup();
  await t.run(async ctx => {
    for (let i = 1; i <= 205; i++) await ctx.db.insert("userTvSeries", {
      userId: "owner", tvSeriesId: i, status: "on_hold", seasonWatchedCounts: { 99: 1 },
      startedAt: -1, lastWatchedAt: 0, createdAt: 10, updatedAt: 20,
    });
  });
  const jobId = await prepare(owner, []);
  await owner.mutation(api.importExport.sealImport, { jobId });
  await step(t, owner, jobId);
  // Reproduce the old by_user pagination/checkpoint, including the first
  // already-committed reset page, rather than generating a new-index cursor.
  await t.run(async ctx => {
    const page = await ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", "owner")).paginate({ cursor: null, numItems: 100 });
    for (const series of page.page) await ctx.db.patch(series._id, { startedAt: undefined, lastWatchedAt: undefined, seasonWatchedCounts: {} });
    await ctx.db.patch(jobId, { cursor: page.continueCursor });
  });
  await owner.mutation(api.dataOperations.resume, { jobId });
  await finish(t, owner, jobId);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 205 })).toMatchObject({ seasonWatchedCounts: {}, status: "on_hold", createdAt: 10, updatedAt: 20 });
  const exported = await downloadBackup({ mutation: owner.mutation, query: owner.query } as unknown as ConvexReactClient, () => {});
  const backup = parseBackup(JSON.parse(await exported.text()));
  expect(backup.tvSeries).toHaveLength(205);
  expect(backup.tvSeries.some(row => "watchSummaryVersion" in row || "seasonWatchedCounts" in row)).toBe(false);
});

test("a pathological season-count map never crosses the 1024-field value limit", async () => {
  const { t, owner } = setup();
  for (let start = 1; start <= 1025; start += 400) await t.run(async ctx => {
    for (let i = start; i < Math.min(start + 400, 1026); i++) await ctx.db.insert("userEpisodes", {
      userId: "owner", tvSeriesId: 1, seasonId: i, episodeId: i, isWatched: true,
      watchedDate: i, createdAt: 10, updatedAt: 20,
    });
  });
  const jobId = await prepare(owner, []);
  await owner.mutation(api.importExport.sealImport, { jobId });
  for (let i = 0; i < 100; i++) {
    const job = await step(t, owner, jobId);
    expect(job.error).toBeUndefined();
    expect(Object.keys(job.summary?.counts ?? {}).length).toBeLessThanOrEqual(1024);
    if (job.phase === "complete") break;
    if (i === 99) throw new Error("Job did not complete");
  }
  const series = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
  expect(series?.seasonWatchedCounts).toBeUndefined();
  expect([series?.startedAt, series?.lastWatchedAt, series?.createdAt, series?.updatedAt]).toEqual([1, 1025, 10, 20]);
  expect(series?.watchSummaryVersion).toBe(1);
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 1, episodeId: 1, isWatched: false });
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ startedAt: 2, lastWatchedAt: 1025 });
  // Overflow stays explicitly unknown until a repair can fit the entire map.
  const repair = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  await finish(t, owner, repair);
  expect(Object.keys((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))!.seasonWatchedCounts!)).toHaveLength(1024);
}, 120000);
