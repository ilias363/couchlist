/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { deriveWatchSummary } from "./lib/tvWatchDates";
import { assertUserIdMigrationWritable } from "./lib/dataOperationLock";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
function setup() {
  const t = convexTest({ schema, modules, transactionLimits: {
    databaseQueries: 512, documentsRead: 1500, documentsWritten: 512,
    bytesRead: 4 * 1024 * 1024, bytesWritten: 4 * 1024 * 1024,
  } });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}
type Test = ReturnType<typeof setup>["t"];
async function seed(t: Test, size: number, legacy = false) {
  for (let start = 1; start <= size; start += 300) await t.run(async ctx => {
    for (let i = start; i < Math.min(size + 1, start + 300); i++) {
      await ctx.db.insert("userEpisodes", {
        userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: i,
        isWatched: true, watchedDate: i - 1, createdAt: 10, updatedAt: 20,
      });
    }
  });
  await t.run(ctx => ctx.db.insert("userTvSeries", {
    userId: "owner", tvSeriesId: 1, status: "on_hold", createdAt: 10, updatedAt: 20,
    startedAt: 0, lastWatchedAt: size - 1,
    ...(!legacy ? { seasonWatchedCounts: { 10: size } } : {}),
  }));
}
async function step(t: Test, jobId: Id<"dataOperations">) {
  const job = await t.run(ctx => ctx.db.get(jobId));
  await t.mutation(internal.dataOperations.runBatch, { jobId, revision: job!.revision });
  return t.run(ctx => ctx.db.get(jobId));
}
async function finish(t: Test, jobId: Id<"dataOperations">) {
  for (let i = 0; i < 100; i++) {
    const job = await step(t, jobId);
    expect(job?.error).toBeUndefined();
    if (job?.phase === "complete") return;
  }
  throw new Error("Repair did not complete");
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

test("real indexed handlers fit an eight-document budget on small and large histories", async () => {
  for (const size of [20, 1000]) {
    const { t, owner } = setup();
    await seed(t, size);
    // Limits apply to the nested real mutation, not the seed/setup transaction.
    const budget = { transactionLimits: { documentsRead: 8, databaseQueries: 8 } };
    await owner.run(async ctx => {
      await ctx.runMutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 10, isWatched: true, watchedAt: 5 }, budget);
    });
    await owner.run(async ctx => {
      await ctx.runMutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: false }, budget);
    });
    await owner.run(async ctx => {
      await ctx.runMutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: size, isWatched: true }, budget);
    });
    await owner.run(async ctx => {
      await ctx.runMutation(api.tv.setSeriesStatus, { tvSeriesId: 1, status: "watched" }, budget);
    });
    const parent = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
    expect(parent).toMatchObject({ startedAt: 1, lastWatchedAt: size - 2, seasonWatchedCounts: { 10: size - 1 }, status: "watched" });
  }
});

test("indexed boundaries exclude invalid/unknown/unwatched dates and preserve ties at zero", async () => {
  const { t, owner } = setup();
  const rows = [
    { isWatched: true, watchedDate: -10 }, { isWatched: true, watchedDate: -10 },
    { isWatched: true, watchedDate: 0 }, { isWatched: true, watchedDate: 0 },
    { isWatched: true }, { isWatched: false, watchedDate: -100 },
    ...[NaN, Infinity, -Infinity, 9e15, -9e15].map(watchedDate => ({ isWatched: true, watchedDate })),
  ].map((fields, i) => ({ userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: i + 1, createdAt: 1, updatedAt: 2, ...fields }));
  await t.run(async ctx => {
    for (const row of rows) await ctx.db.insert("userEpisodes", row);
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 1, status: "up_to_date", createdAt: 1, updatedAt: 2, ...deriveWatchSummary(rows) });
  });
  const toggle = (episodeId: number, isWatched: boolean, watchedAt?: number) => owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId, isWatched, watchedAt });
  await toggle(1, false);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ startedAt: -10, lastWatchedAt: 0 });
  await toggle(2, true, 10);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ startedAt: 0, lastWatchedAt: 10 });
  await toggle(2, true);
  await toggle(3, false);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ startedAt: 0, lastWatchedAt: 0 });
  await toggle(4, false);
  const final = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
  expect([final?.startedAt, final?.lastWatchedAt, final?.status]).toEqual([undefined, undefined, "up_to_date"]);
  expect(final?.seasonWatchedCounts).toEqual({ 10: 7 });
});

test("legacy repair is bounded, owner-fenced, resumable and idempotent while preserving timestamps", async () => {
  const { t, owner, other } = setup();
  await seed(t, 205, true);
  await expect(owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 10, isWatched: false })).rejects.toThrow(/needs repair/);
  const jobId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  expect(await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 })).toBe(jobId);
  await expect(t.mutation(api.dataOperations.resume, { jobId })).rejects.toThrow(/Unauthorized/);
  await expect(other.mutation(api.dataOperations.resume, { jobId })).rejects.toThrow(/not found/);
  await expect(other.query(api.dataOperations.status, { jobId })).rejects.toThrow(/not found/);
  await expect(owner.mutation(api.tv.setSeriesStatus, { tvSeriesId: 1, status: "watched" })).rejects.toThrow(/operation/);
  await other.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: -1 });
  await step(t, jobId); // first 100 episodes; published legacy summary is retained
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.lastWatchedAt).toBe(204);
  const checkpoint = await owner.query(api.dataOperations.status, { jobId });
  expect(checkpoint.summary?.counts).toEqual({ 10: 100 });
  await t.mutation(internal.dataOperations.runBatch, { jobId, revision: checkpoint.revision - 1 });
  expect((await owner.query(api.dataOperations.status, { jobId })).summary?.counts).toEqual({ 10: 100 });
  await owner.mutation(api.dataOperations.resume, { jobId });
  await finish(t, jobId);
  const repaired = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
  expect(repaired).toMatchObject({ startedAt: 0, lastWatchedAt: 204, seasonWatchedCounts: { 10: 205 }, status: "on_hold", createdAt: 10, updatedAt: 20, watchSummaryVersion: 1 });
  await t.run(ctx => ctx.db.patch(repaired!._id, { seasonWatchedCounts: { 99: 1 } }));
  const again = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  await finish(t, again);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toEqual(repaired);
  await owner.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: false });
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.startedAt).toBe(1);
});

test("orphan repair recreates the parent from watched evidence without inventing unknown dates", async () => {
  const { t, owner } = setup();
  await t.run(async ctx => {
    await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, createdAt: 10, updatedAt: 20 });
    await ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: 2, isWatched: true, watchedDate: -10, createdAt: 5, updatedAt: 25 });
  });
  const jobId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  await finish(t, jobId);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ status: "currently_watching", startedAt: -10, lastWatchedAt: -10, seasonWatchedCounts: { 10: 2 }, createdAt: 5, updatedAt: 25 });
});

test("watched orphan history with an unknown date still requires repair", async () => {
  const { t, owner } = setup();
  await t.run(ctx => ctx.db.insert("userEpisodes", {
    userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, createdAt: 1, updatedAt: 2,
  }));
  await expect(owner.mutation(api.tv.toggleEpisodeWatched, {
    tvSeriesId: 1, seasonId: 10, episodeId: 2, isWatched: true, watchedAt: 0,
  })).rejects.toThrow(/needs repair/);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toBeNull();
  expect((await owner.query(api.tv.getSeasonEpisodesStatus, { tvSeriesId: 1, seasonId: 10 })).map(ep => ep.episodeId)).toEqual([1]);
});

test.each(["owner", "other"])("ID migration guard fences an active repair on %s without running the migration", async busyUser => {
  const { t, owner, other } = setup();
  const client = busyUser === "owner" ? owner : other;
  await client.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: 0 });
  const jobId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: busyUser, tvSeriesId: 1 });
  await step(t, jobId); // Summary committed, but the operation is still active.
  const checkpoint = await client.query(api.dataOperations.status, { jobId });
  await expect(t.run(ctx => assertUserIdMigrationWritable(ctx, "owner", "other"))).rejects.toThrow(/data operation is in progress/);
  expect(await client.query(api.dataOperations.status, { jobId })).toEqual(checkpoint);
  await finish(t, jobId);
  await t.run(ctx => assertUserIdMigrationWritable(ctx, "owner", "other"));
  expect(await client.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ seasonWatchedCounts: { 10: 1 }, startedAt: 0, lastWatchedAt: 0 });
});

test("repair rejects duplicate identities and rolls back its batch before recording a resumable error", async () => {
  const { t, owner } = setup();
  await seed(t, 20, true);
  const duplicate = await t.run(ctx => ctx.db.insert("userEpisodes", { userId: "owner", tvSeriesId: 1, seasonId: 10, episodeId: 15, isWatched: true, createdAt: 1, updatedAt: 2 }));
  const jobId = await t.mutation(internal.migrations.repairTvSeriesDates, { userId: "owner", tvSeriesId: 1 });
  const failed = await step(t, jobId);
  expect(failed?.error).toContain("duplicate episode");
  expect(failed?.summary?.counts).toEqual({});
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.lastWatchedAt).toBe(19);
  await t.run(ctx => ctx.db.delete(duplicate));
  await owner.mutation(api.dataOperations.resume, { jobId });
  await finish(t, jobId);
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.seasonWatchedCounts).toEqual({ 10: 20 });
});

test("global backfill logs completion only after bounded repairs finish; reruns skip populated summaries", async () => {
  const { t, owner } = setup();
  await seed(t, 205, true);
  await t.run(ctx => ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 2, status: "dropped", createdAt: 10, updatedAt: 20 }));
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    expect((await t.mutation(internal.migrations.backfillSeasonWatchedCounts, {})).status).toBe("running_in_background");
    expect(log).not.toHaveBeenCalled();
    await t.finishAllScheduledFunctions(vi.runAllTimers, 100);
    expect(log.mock.calls).toEqual([["Season watched-count backfill completed."]]);
    const first = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 });
    const second = await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 });
    expect(first).toMatchObject({ seasonWatchedCounts: { 10: 205 }, createdAt: 10, updatedAt: 20 });
    expect(second).toMatchObject({ seasonWatchedCounts: {}, createdAt: 10, updatedAt: 20 });
    await t.mutation(internal.migrations.backfillSeasonWatchedCounts, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 100);
    expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toEqual(first);
    expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).toEqual(second);
  } finally { log.mockRestore(); }
});

test("empty backfills report completion immediately", async () => {
  const { t } = setup();
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    expect(await t.mutation(internal.migrations.backfillSeasonWatchedCounts, {})).toEqual({ status: "completed", message: "Season watched-count backfill completed." });
    expect(log.mock.calls).toEqual([["Season watched-count backfill completed."]]);
  } finally { log.mockRestore(); }
});

test("queued tab edits keep episode writes, status and summaries consistent across bulk batches", async () => {
  const { t, owner } = setup();
  const secondTab = t.withIdentity({ subject: "owner" });
  const args = { tvSeriesId: 1, seasonId: 10, isWatched: true, watchedAt: 0,
    episodesInfo: Array.from({ length: 20 }, (_, i) => ({ episodeId: i + 1 })),
  };
  await Promise.all([
    owner.mutation(api.tv.bulkToggleSeasonEpisodes, args),
    secondTab.mutation(api.tv.bulkToggleSeasonEpisodes, { ...args, seasonId: 20, watchedAt: -1, episodesInfo: [{ episodeId: 21 }] }),
  ]);
  await Promise.all([
    secondTab.mutation(api.tv.toggleEpisodeWatched, { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: false }),
    owner.mutation(api.tv.setSeriesStatus, { tvSeriesId: 1, status: "dropped" }),
  ]);
  const rows = await t.run(ctx => ctx.db.query("userEpisodes").withIndex("by_user_tv", q => q.eq("userId", "owner").eq("tvSeriesId", 1)).take(100));
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 })).toMatchObject({ ...deriveWatchSummary(rows), status: "dropped", seasonWatchedCounts: { 10: 19, 20: 1 } });
});

test("public episode writes authorize identity, reject collisions and invalid input atomically", async () => {
  const { t, owner, other } = setup();
  const args = { tvSeriesId: 1, seasonId: 10, episodeId: 1, isWatched: true, watchedAt: 0 };
  await expect(t.mutation(api.tv.toggleEpisodeWatched, args)).rejects.toThrow(/Unauthorized/);
  await expect(t.mutation(api.tv.bulkToggleSeasonEpisodes, { tvSeriesId: 1, seasonId: 10, episodesInfo: [{ episodeId: 1 }], isWatched: true })).rejects.toThrow(/Unauthorized/);
  await owner.mutation(api.tv.toggleEpisodeWatched, args);
  await other.mutation(api.tv.toggleEpisodeWatched, { ...args, watchedAt: -10 });
  await expect(owner.mutation(api.tv.bulkToggleSeasonEpisodes, { tvSeriesId: 2, seasonId: 20, episodesInfo: [{ episodeId: 2 }, { episodeId: 1 }], isWatched: true })).rejects.toThrow(/different series/);
  await expect(owner.mutation(api.tv.bulkToggleSeasonEpisodes, { tvSeriesId: 1, seasonId: 10, episodesInfo: [{ episodeId: 2 }, { episodeId: 2 }], isWatched: true })).rejects.toThrow(/Duplicate/);
  await expect(owner.mutation(api.tv.toggleEpisodeWatched, { ...args, watchedAt: Infinity })).rejects.toThrow(/valid timestamp/);
  expect(await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 2 })).toBeNull();
  expect((await owner.query(api.tv.getSeasonEpisodesStatus, { tvSeriesId: 1, seasonId: 10 })).map(ep => ep.episodeId)).toEqual([1]);
  expect((await owner.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.startedAt).toBe(0);
  expect((await other.query(api.tv.getSeriesStatus, { tvSeriesId: 1 }))?.startedAt).toBe(-10);
});
