import { v } from "convex/values";
import { query, mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { UserStats } from "../lib/types";
import { currentOperation, requireOwner } from "./lib/dataOperationLock";
import { currentStatsJob, cancelStatsPass } from "./lib/statsFence";
import { activityDay, addMovie, addSeries, addEpisode, emptyStats, finishStats, statsValidator, STATS_TTL, DAY } from "./lib/statsModel";

export const STATS_BATCH_SIZE = 64;
export const STATS_LEASE_MS = 60_000;
// Tighter than Convex 1.43's transaction limits. The outer wrapper retains
// headroom to record failure after a nested batch rolls back, including limits.
export const STATS_BATCH_LIMITS = {
  documentsRead: 512, databaseQueries: 256, documentsWritten: 192,
  bytesRead: 4 * 1024 * 1024, bytesWritten: 1024 * 1024,
  functionsScheduled: 1, scheduledFunctionArgsBytes: 1024,
};
const checkpointArgs = { jobId: v.id("statsRebuilds"), revision: v.number() };
const jobStatus = v.object({
  jobId: v.id("statsRebuilds"), status: v.union(v.literal("running"), v.literal("failed"), v.literal("complete")),
  phase: v.string(), processed: v.number(), restarts: v.number(), updatedAt: v.number(),
  error: v.union(v.string(), v.null()),
});

// Read only: three indexed point reads, no history, clock, writes or scheduling.
export const getUserStats = query({
  args: {},
  returns: v.object({ ownerId: v.string(), stats: v.union(statsValidator, v.null()), lastRefreshed: v.union(v.number(), v.null()), blocked: v.boolean(), job: v.union(jobStatus, v.null()) }),
  handler: async ctx => {
    const userId = await requireOwner(ctx);
    const snapshot = await ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", userId)).unique();
    const job = await currentStatsJob(ctx, userId);
    const operation = await currentOperation(ctx, userId);
    // Hide snapshots immediately when account deletion starts, even before the
    // bounded deletion pass reaches userStats.
    const deletingAccount = operation?.kind === "account";
    return {
      ownerId: userId,
      stats: deletingAccount ? null : (snapshot?.stats as UserStats | undefined) ?? null,
      lastRefreshed: deletingAccount ? null : snapshot?.lastRefreshed ?? null,
      blocked: !!operation && operation.phase !== "complete",
      job: job ? { jobId: job._id, status: job.status, phase: job.phase, processed: job.processed, restarts: job.restarts, updatedAt: job.updatedAt, error: job.error ?? null } : null,
    };
  },
});

async function requestRebuild(ctx: MutationCtx, force: boolean) {
  const userId = await requireOwner(ctx);
  const operation = await currentOperation(ctx, userId);
  if (operation && operation.phase !== "complete") throw new Error("A data operation is in progress. Finish or resume it in Settings first.");
  const now = Date.now();
  const job = await currentStatsJob(ctx, userId);
  if (job && job.status !== "complete") {
    // Strict Mode, remounts and tabs converge on the same checkpoint. Explicit
    // retry resumes a failed batch; a lost scheduled callback has a short lease.
    if ((force && job.status === "failed") || (job.status === "running" && now - job.updatedAt >= STATS_LEASE_MS)) {
      await ctx.db.patch(job._id, { status: "running", error: undefined, updatedAt: now, revision: job.revision + 1 });
      await ctx.scheduler.runAfter(0, internal.stats.runBatch, { jobId: job._id, revision: job.revision + 1 });
    }
    return job._id;
  }
  const snapshot = await ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", userId)).unique();
  if (!force && snapshot && now - snapshot.lastRefreshed < STATS_TTL) return null;
  if (job) await ctx.db.delete(job._id);
  const jobId = await ctx.db.insert("statsRebuilds", {
    userId, status: "running", phase: "movies", revision: 0, cursor: null,
    stats: emptyStats(now), processed: 0, restarts: 0, sourceChanged: false, updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.stats.runBatch, { jobId, revision: 0 });
  return jobId;
}
export const ensureStats = mutation({ args: {}, returns: v.union(v.id("statsRebuilds"), v.null()), handler: ctx => requestRebuild(ctx, false) });
export const refreshStats = mutation({ args: {}, returns: v.union(v.id("statsRebuilds"), v.null()), handler: ctx => requestRebuild(ctx, true) });

async function fact(ctx: MutationCtx, job: Doc<"statsRebuilds">, kind: "day" | "season", key: number) {
  const existing = await ctx.db.query("statsFacts").withIndex("by_job_kind_key", q => q.eq("jobId", job._id).eq("kind", kind).eq("key", key)).unique();
  if (existing) return false;
  await ctx.db.insert("statsFacts", { userId: job.userId, jobId: job._id, kind, key });
  return true;
}
const pageOptions = (cursor: string | null) => ({ cursor, numItems: STATS_BATCH_SIZE, maximumRowsRead: STATS_BATCH_SIZE, maximumBytesRead: 256 * 1024 });

export const processBatch = internalMutation({
  args: checkpointArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.revision !== args.revision || job.status !== "running") return null;
    const operation = await currentOperation(ctx, job.userId);
    if (operation && operation.phase !== "complete") { await cancelStatsPass(ctx, job.userId); return null; }
    const advance = (phase: Doc<"statsRebuilds">["phase"]) => { job.phase = phase; job.cursor = null; };
    // Discard mixed input, collect scratch in bounded chunks, then take a new
    // reference time and restart. Never block ordinary watch edits for stats.
    if (job.sourceChanged) advance("cleanup");
    if (job.phase === "movies") {
      const page = await ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const movie of page.page) {
        addMovie(job.stats, movie);
        const day = activityDay(movie.watchedDate);
        if (movie.status === "watched" && day !== null) await fact(ctx, job, "day", day);
      }
      job.processed += page.page.length; job.cursor = page.continueCursor;
      if (page.isDone) advance("tv");
    } else if (job.phase === "tv") {
      const page = await ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const series of page.page) addSeries(job.stats, series);
      job.processed += page.page.length; job.cursor = page.continueCursor;
      if (page.isDone) advance("episodes");
    } else if (job.phase === "episodes") {
      const page = await ctx.db.query("userEpisodes").withIndex("by_user_watched", q => q.eq("userId", job.userId).eq("isWatched", true)).paginate(pageOptions(job.cursor));
      for (const episode of page.page) {
        addEpisode(job.stats, episode);
        if (await fact(ctx, job, "season", episode.seasonId)) job.stats.episodes.totalWatchedSeasons++;
        const day = activityDay(episode.watchedDate);
        if (day !== null) await fact(ctx, job, "day", day);
      }
      job.processed += page.page.length; job.cursor = page.continueCursor;
      if (page.isDone) advance("streaks");
    } else if (job.phase === "streaks") {
      const page = await ctx.db.query("statsFacts").withIndex("by_job_kind_key", q => q.eq("jobId", job._id).eq("kind", "day")).paginate(pageOptions(job.cursor));
      for (const day of page.page) {
        job.stats.streaks.current = job.previousDay === undefined || day.key - job.previousDay === DAY ? job.stats.streaks.current + 1 : 1;
        job.stats.streaks.longest = Math.max(job.stats.streaks.longest, job.stats.streaks.current);
        job.previousDay = day.key;
      }
      job.cursor = page.continueCursor;
      if (page.isDone) { finishStats(job.stats, job.previousDay); advance("cleanup"); }
    } else {
      const rows = await ctx.db.query("statsFacts").withIndex("by_job_kind_key", q => q.eq("jobId", job._id)).take(STATS_BATCH_SIZE);
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length < STATS_BATCH_SIZE) {
        if (job.sourceChanged) {
          job.stats = emptyStats(Date.now()); job.processed = 0; job.restarts++;
          job.previousDay = undefined; job.sourceChanged = false; advance("movies");
        } else {
          const snapshot = await ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", job.userId)).unique();
          // TTL starts at the captured input time, not completion of a long job.
          const value = { stats: job.stats, lastRefreshed: job.stats.generatedAt };
          if (snapshot) await ctx.db.patch(snapshot._id, value);
          else await ctx.db.insert("userStats", { userId: job.userId, ...value });
          job.status = "complete";
        }
      }
    }
    const { _id, _creationTime, ...fields } = job;
    void _creationTime;
    await ctx.db.replace(_id, { ...fields, revision: job.revision + 1, updatedAt: Date.now() });
    if (job.status === "running") await ctx.scheduler.runAfter(0, internal.stats.runBatch, { jobId: _id, revision: job.revision + 1 });
    return null;
  },
});

export const runBatch = internalMutation({
  args: checkpointArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.revision !== args.revision || job.status !== "running") return null;
    try {
      await ctx.runMutation(internal.stats.processBatch, args, { transactionLimits: STATS_BATCH_LIMITS });
    } catch (error) {
      await ctx.db.patch(job._id, { status: "failed", updatedAt: Date.now(), error: error instanceof Error ? error.message.slice(0, 300) : "Stats batch failed. Retry refresh." });
    }
    return null;
  },
});

export const cleanupFacts = internalMutation({
  args: { jobId: v.id("statsRebuilds") }, returns: v.null(),
  handler: async (ctx, args) => {
    // Only collect cancelled jobs; duplicate garbage collectors are harmless.
    if (await ctx.db.get(args.jobId)) return null;
    const rows = await ctx.db.query("statsFacts").withIndex("by_job_kind_key", q => q.eq("jobId", args.jobId)).take(STATS_BATCH_SIZE);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === STATS_BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.stats.cleanupFacts, args);
    return null;
  },
});
