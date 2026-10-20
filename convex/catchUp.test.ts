/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { FunctionReturnType } from "convex/server";
import { parseBackup } from "./lib/backupFormat";
import { seasonPlan } from "../lib/catch-up";
import type { TMDBTvSeries } from "../lib/tmdb/types";

const modules = import.meta.glob("./**/*.ts");

test("verified shows still export and round-trip the version 1 backup format", async () => {
  const t = convexTest(schema, modules); const owner = t.withIdentity({ subject: "owner" });
  await t.run(async ctx => {
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", seasonWatchedCounts: { "10": 1 }, watchSummaryVersion: 1, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, createdAt: 1, updatedAt: 1 });
  });
  expect(await owner.mutation(api.catchUp.verifySeasons, { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: "2020-01-01", episodeIds: [1] }] })).toBe(true);
  const jobId = await owner.mutation(api.importExport.startExport, {});
  const result = await owner.query(api.importExport.exportData, { jobId, kind: "tvSeries", paginationOpts: { cursor: null, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 } });
  expect(result.isDone).toBe(true);
  const backup = parseBackup({ schema: "couchlist.export", version: 1, tvSeries: result.page.map(row => row.value) });
  expect(backup.tvSeries).toEqual([{ tvSeriesId: 1, status: "up_to_date", createdAt: 1, updatedAt: 1 }]);
  expect((await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0].catchUpVerifiedSeasons?.["10"]).toBeDefined();
});

test("revocations survive count 10 to 11 to 10, isolate users, and preserve newer evidence", async () => {
  const t = convexTest(schema, modules); const owner = t.withIdentity({ subject: "owner" }); const other = t.withIdentity({ subject: "other" });
  const proof = { episodeCount: 10, airDate: "2020-01-01", watchedCount: 10 };
  await t.run(async ctx => {
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", seasonWatchedCounts: { "10": 10, "20": 10 }, catchUpVerifiedSeasons: { "10": proof, "20": proof }, createdAt: 1, updatedAt: 1 });
    for (let episodeId = 1; episodeId <= 10; episodeId++) await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true, createdAt: 1, updatedAt: 1 });
  });
  const args = { tvSeriesId: 1, seasons: [{ seasonId: 10, ...proof }] };
  await expect(t.mutation(api.catchUp.revokeVerifications, args)).rejects.toThrow(/Unauthorized/);
  await other.mutation(api.catchUp.revokeVerifications, args);
  const row = async () => (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
  const series = (count: number) => ({ seasons: [{ id: 10, season_number: 1, episode_count: count, air_date: "2020-01-01" }], last_episode_to_air: { season_number: 1, episode_number: 11, air_date: "2020-01-01" } }) as TMDBTvSeries;
  expect(seasonPlan(series(10), await row(), "2026-10-20")[0].kind).toBe("complete");
  expect(seasonPlan(series(11), await row(), "2026-10-20")[0].kind).toBe("candidate");
  const metrics = await owner.run(async ctx => {
    await ctx.runMutation(api.catchUp.revokeVerifications, args, { transactionLimits: { documentsRead: 2, databaseQueries: 1 } });
    return ctx.meta.getTransactionMetrics();
  });
  expect(metrics.documentsRead.used).toBe(2); expect(metrics.databaseQueries.used).toBe(1);
  expect(seasonPlan(series(10), await row(), "2026-10-20")[0].kind).toBe("candidate");
  expect((await row()).catchUpVerifiedSeasons?.["20"]).toEqual(proof);
  expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 1, seasonId: 10, episodeIds: Array.from({ length: 10 }, (_, i) => i + 2) })).toHaveLength(9);
  // A fresh verification after a watch change must survive a delayed old revoke.
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 11, isWatched: true });
  await owner.mutation(api.catchUp.verifySeasons, { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: "2020-01-01", episodeIds: Array.from({ length: 11 }, (_, i) => i + 1) }] });
  await owner.mutation(api.catchUp.revokeVerifications, args);
  expect((await row()).catchUpVerifiedSeasons?.["10"]?.episodeCount).toBe(11);
  await expect(owner.mutation(api.catchUp.revokeVerifications, { tvSeriesId: 1, seasons: Array.from({ length: 101 }, (_, i) => ({ seasonId: i + 1, ...proof })) })).rejects.toThrow(/100 seasons/);
});

test("summary pagination is independent of full history and isolated by authenticated user", async () => {
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 101, databaseQueries: 101 } });
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  await t.run(async ctx => {
    for (let i = 1; i <= 61; i++) await ctx.db.insert("userTvSeries", {
      userId: "owner", tvSeriesId: i, status: "up_to_date", seasonWatchedCounts: { "10": 80 }, createdAt: i, updatedAt: i,
    });
    await ctx.db.insert("userTvSeries", { userId: "other", tvSeriesId: 999, status: "up_to_date", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 998, status: "on_hold", createdAt: 1, updatedAt: 1 });
  });
  // 2,000 historical rows cannot fit in the enforced 101-read transaction.
  for (let batch = 0; batch < 20; batch++) await t.run(async ctx => {
    for (let j = 1; j <= 100; j++) await ctx.db.insert("userEpisodes", {
      userId: "owner", tvSeriesId: 61, seasonId: 10, episodeId: batch * 100 + j,
      isWatched: true, createdAt: 1, updatedAt: 1,
    });
  });
  const ids: number[] = [];
  // A summary page still succeeds with a 26-document budget despite history.
  const summaryReads = await owner.run(async ctx => {
    await ctx.runQuery(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } }, {
      transactionLimits: { documentsRead: 26 },
    });
    return ctx.meta.getTransactionMetrics();
  });
  expect(summaryReads.documentsRead.used).toBeLessThanOrEqual(26);
  expect(summaryReads.databaseQueries.used).toBe(2);
  let cursor: string | null = null;
  for (let i = 0; i < 3; i++) {
    const result: FunctionReturnType<typeof api.catchUp.list> = await owner.query(api.catchUp.list, { paginationOpts: { cursor, numItems: 25 } });
    expect(result.page.length).toBeLessThanOrEqual(25);
    expect(result.page.every(row => Object.keys(row).sort().join() === "seasonWatchedCounts,summariesReady,tvSeriesId")).toBe(true);
    ids.push(...result.page.map(row => row.tvSeriesId));
    cursor = result.continueCursor;
    expect(result.isDone).toBe(i === 2);
  }
  expect(ids).toEqual(Array.from({ length: 61 }, (_, i) => 61 - i));
  // Native reactive pages pin an end cursor and can grow beyond numItems.
  // Even an entire 61-show range must respect the server's 50-row budget.
  const expanded = await owner.query(api.catchUp.list, { paginationOpts: {
    cursor: null, endCursor: cursor!, numItems: 25, maximumRowsRead: 1000,
  } });
  expect(expanded.page.length).toBeLessThanOrEqual(50);
  expect(expanded.pageStatus).toBe("SplitRequired");
  expect(expanded.splitCursor).toBeTruthy();
  expect((await other.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page).toEqual([{ tvSeriesId: 999, summariesReady: true }]);
  expect((await t.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page).toEqual([]);
  await expect(owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 51 } })).rejects.toThrow(/1 and 50/);
  const candidateReads = await owner.run(async ctx => {
    const ids = await ctx.runQuery(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: Array.from({ length: 100 }, (_, i) => i + 1) });
    expect(ids).toHaveLength(100);
    return ctx.meta.getTransactionMetrics();
  });
  expect(candidateReads.documentsRead.used).toBe(100);
  expect(candidateReads.databaseQueries.used).toBe(100);
  console.info(`Catch-up in-memory reads with 2,000 history rows: summary page ${summaryReads.documentsRead.used} documents / ${summaryReads.databaseQueries.used} query; candidate IDs ${candidateReads.documentsRead.used} documents / ${candidateReads.databaseQueries.used} queries.`);
  expect(await other.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await t.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 60, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 11, episodeIds: [1] })).toEqual([]);
  await expect(owner.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: Array.from({ length: 101 }, (_, i) => i + 1) })).rejects.toThrow(/at most 100/);
});

test("completeness evidence is verified, isolated, bounded and invalidated by same-time watch changes", async () => {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 105, databaseQueries: 105 } });
  const owner = t.withIdentity({ subject: "owner" }); const other = t.withIdentity({ subject: "other" });
  try {
    await t.run(async ctx => {
      await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", seasonWatchedCounts: { "10": 3, "20": 2 },
        catchUpVerifiedSeasons: { "20": { episodeCount: 2, watchedCount: 2, airDate: "2020-01-01" } }, createdAt: 1, updatedAt: 1 });
      for (let episodeId = 1; episodeId <= 3; episodeId++) await ctx.db.insert("userEpisodes", {
        userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true, createdAt: 1, updatedAt: 1,
      });
      for (const episodeId of [11, 12]) await ctx.db.insert("userEpisodes", {
        userId: "owner", tvSeriesId: 1, seasonId: 20, episodeId, isWatched: true, createdAt: 1, updatedAt: 1,
      });
    });
    const verification = { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: "2020-01-01", episodeIds: [1, 2, 3] }] };
    expect(await other.mutation(api.catchUp.verifySeasons, verification)).toBe(false);
    await expect(t.mutation(api.catchUp.verifySeasons, verification)).rejects.toThrow(/Unauthorized/);
    expect(await owner.mutation(api.catchUp.verifySeasons, verification)).toBe(true);
    let row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
    expect(row.catchUpVerifiedSeasons?.["10"]).toEqual({ episodeCount: 3, airDate: "2020-01-01", watchedCount: 3 });
    // Master's incremental path must retain proof on retries/date-only edits,
    // and stay bounded even when catch-up evidence is present.
    await owner.run(ctx => ctx.runMutation(api.tv.toggleEpisodeWatched, {
      tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: 0,
    }, { transactionLimits: { documentsRead: 8, databaseQueries: 8 } }));
    await owner.mutation(api.tv.bulkToggleSeasonEpisodes, {
      tvSeriesId: 1, seasonId: 10, episodesInfo: [1, 2, 3].map(episodeId => ({ episodeId })), isWatched: true,
    });
    expect((await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0].catchUpVerifiedSeasons?.["10"]).toBeDefined();
    await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 3, isWatched: false });
    await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 4, isWatched: true });
    row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
    expect(row.seasonWatchedCounts?.["10"]).toBe(3);
    expect(row.catchUpVerifiedSeasons?.["10"]).toBeUndefined();
    expect(row.catchUpVerifiedSeasons?.["20"]).toBeDefined(); // Unchanged history stays skippable.
    expect(await owner.mutation(api.catchUp.verifySeasons, verification)).toBe(false);
    expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 1, seasonId: 10, episodeIds: [1, 2, 3], retry: 1 })).toEqual([1, 2]);
    const current = { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: "2020-01-01", episodeIds: [1, 2, 4] }] };
    expect(await owner.mutation(api.catchUp.verifySeasons, current)).toBe(true);
    await owner.mutation(api.tv.setSeriesStatus, { tvSeriesId: 1, status: "up_to_date" });
    expect((await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0].catchUpVerifiedSeasons?.["10"]).toBeDefined();
    await owner.mutation(api.tv.bulkToggleSeasonEpisodes, { tvSeriesId: 1, seasonId: 10, episodesInfo: [{ episodeId: 1 }, { episodeId: 2 }], isWatched: false });
    row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
    expect(row.catchUpVerifiedSeasons?.["10"]).toBeUndefined();
    expect(row.catchUpVerifiedSeasons?.["20"]).toBeDefined();
    await expect(owner.mutation(api.catchUp.verifySeasons, { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: null, episodeIds: Array.from({ length: 101 }, (_, i) => i + 1) }] })).rejects.toThrow(/100 episodes/);
    await expect(owner.query(api.catchUp.watchedIds, { tvSeriesId: 1, seasonId: 10, episodeIds: [1], retry: -1 })).rejects.toThrow(/Invalid retry/);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

test("scoped summary repair hides intermediate proof and clears only the repaired show's evidence", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules); const owner = t.withIdentity({ subject: "owner" });
  try {
    await t.run(async ctx => {
      for (const tvSeriesId of [1, 2]) await ctx.db.insert("userTvSeries", {
        userId: "owner", tvSeriesId, status: "up_to_date", seasonWatchedCounts: { "10": 2 }, watchSummaryVersion: 1,
        catchUpVerifiedSeasons: { "10": { episodeCount: 2, watchedCount: 2, airDate: "2020-01-01" } }, createdAt: 1, updatedAt: 1,
      });
      for (const episodeId of [1, 3]) await ctx.db.insert("userEpisodes", {
        userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true, createdAt: 1, updatedAt: 1,
      });
    });
    const jobId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
    expect(await owner.query(api.catchUp.isReady, {})).toBe(false);
    const during = await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } });
    expect(during.page.every(row => !row.summariesReady && !row.catchUpVerifiedSeasons)).toBe(true);
    for (let i = 0; i < 10; i++) {
      const job = await owner.query(api.dataOperations.status, { jobId });
      if (job.phase === "complete") break;
      expect(job.error).toBeUndefined();
      await t.mutation(internal.dataOperations.runBatch, { jobId, revision: job.revision });
    }
    expect(await owner.query(api.catchUp.isReady, {})).toBe(true);
    const repaired = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
    expect(repaired).toMatchObject({ watchSummaryVersion: 1, seasonWatchedCounts: { "10": 2 }, status: "up_to_date", createdAt: 1, updatedAt: 1 });
    expect(repaired?.catchUpVerifiedSeasons).toBeUndefined();
    expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 }))?.catchUpVerifiedSeasons?.["10"]).toBeDefined();
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

test("real import batches hide stale and reset summaries until rebuilding completes", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules); const owner = t.withIdentity({ subject: "owner" });
  try {
    await t.run(async ctx => {
      await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", seasonWatchedCounts: { "10": 2 },
        catchUpVerifiedSeasons: { "10": { episodeCount: 2, watchedCount: 2, airDate: "2020-01-01" } }, createdAt: 1, updatedAt: 1 });
    });
    const jobId = await owner.mutation(api.importExport.startImport, {
      schema: "couchlist.export", version: 1, mode: "merge", fingerprint: "a".repeat(64), expected: { movies: 0, tvSeries: 0, episodes: 3 },
    });
    await owner.mutation(api.importExport.stageImport, { jobId, offset: 0, rows: [1, 2, 3].map(episodeId => ({ kind: "episodes" as const, value: { tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true } })) });
    expect(await owner.query(api.catchUp.isReady, {})).toBe(true); // Upload has not changed the library.
    await owner.mutation(api.importExport.sealImport, { jobId });
    let sawReset = false;
    for (let i = 0; i < 20; i++) {
      const job = await owner.query(api.dataOperations.status, { jobId });
      if (job.phase === "complete") break;
      expect(await owner.query(api.catchUp.isReady, {})).toBe(false);
      expect(await t.withIdentity({ subject: "other" }).query(api.catchUp.isReady, {})).toBe(true);
      const row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
      expect(row.summariesReady).toBe(false); expect(row.seasonWatchedCounts).toBeUndefined(); expect(row.catchUpVerifiedSeasons).toBeUndefined();
      if (job.phase === "summaries") {
        sawReset = true;
        expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.seasonWatchedCounts).toEqual({});
        expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 1, seasonId: 10, episodeIds: [1, 2, 3] })).toEqual([1, 2, 3]);
        expect(await owner.mutation(api.catchUp.verifySeasons, { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: null, episodeIds: [1, 2, 3] }] })).toBe(false);
      }
      await t.mutation(internal.dataOperations.processBatch, { jobId, revision: job.revision });
    }
    expect(sawReset).toBe(true); expect(await owner.query(api.catchUp.isReady, {})).toBe(true);
    const row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
    expect(row.summariesReady).toBe(true); expect(row.seasonWatchedCounts).toEqual({ "10": 3 }); expect(row.catchUpVerifiedSeasons).toBeUndefined();
    expect((await owner.query(api.dataOperations.status, { jobId })).phase).toBe("complete");
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

test("proof writes cap both verification reads and stored season evidence", async () => {
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 103, databaseQueries: 102 } });
  const owner = t.withIdentity({ subject: "owner" });
  await t.run(async ctx => {
    const zero = { movies: 0, tvSeries: 0, episodes: 0 };
    await ctx.db.insert("dataOperations", { userId: "owner", kind: "import", phase: "complete", expected: zero, uploaded: zero, inserted: zero, updated: zero,
      position: 0, revision: 0, processed: 0, deleted: 0, startedAt: 1, expiresAt: 2, cursor: null });
    const counts: Record<string, number> = { "10": 100 };
    const proofs: Record<string, { episodeCount: number; watchedCount: number; airDate: null }> = {};
    for (let n = 1000; n < 1100; n++) {
      counts[String(n)] = 1; proofs[String(n)] = { episodeCount: 1, watchedCount: 1, airDate: null };
      await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: n, episodeId: n + 1, isWatched: true, createdAt: 1, updatedAt: 1 });
    }
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", seasonWatchedCounts: counts, catchUpVerifiedSeasons: proofs, createdAt: 1, updatedAt: 1 });
    for (let episodeId = 1; episodeId <= 100; episodeId++) await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId, isWatched: true, createdAt: 1, updatedAt: 1 });
  });
  const metrics = await owner.run(async ctx => {
    expect(await ctx.runMutation(api.catchUp.verifySeasons, { tvSeriesId: 1, seasons: [{ seasonId: 10, airDate: "2020-01-01", episodeIds: Array.from({ length: 100 }, (_, i) => i + 1) }] })).toBe(true);
    return ctx.meta.getTransactionMetrics();
  });
  // 100 episode reads, the operation and series rows, plus the patch's read.
  expect(metrics.documentsRead.used).toBe(103); expect(metrics.databaseQueries.used).toBe(102);
  const row = (await owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page[0];
  expect(Object.keys(row.catchUpVerifiedSeasons!)).toHaveLength(100);
  expect(row.catchUpVerifiedSeasons?.["10"].episodeCount).toBe(100);
});
