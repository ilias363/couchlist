import { v } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { BATCH_SIZE, type BackupRow, type BackupKind } from "./lib/backupFormat";
import { currentOperation, requireOwner } from "./lib/dataOperationLock";
import { isValidWatchDate } from "./lib/tvWatchDates";

type Job = Doc<"dataOperations">;
const emptyCounts = () => ({ movies: 0, tvSeries: 0, episodes: 0 });
const idleLifetime = 24 * 60 * 60 * 1000;
const jobArgs = { jobId: v.id("dataOperations") };
const checkpointArgs = { ...jobArgs, revision: v.number() };
// Convex 1.43 predates schema.doc/docValidator. Derive the document validator
// from the table so the job schema and public return shape cannot drift.
const jobDocument = v.object({ ...schema.tables.dataOperations.validator.fields, _id: v.id("dataOperations"), _creationTime: v.number() });

export async function ownedJob(ctx: QueryCtx, jobId: Id<"dataOperations">) {
  const userId = await requireOwner(ctx);
  const job = await ctx.db.get(jobId);
  if (!job || job.userId !== userId) throw new Error("Data operation not found");
  return job;
}

export async function createOperation(
  ctx: MutationCtx, userId: string, kind: Job["kind"],
  options: { mode?: Job["mode"]; fingerprint?: string; expected?: Job["expected"]; tvSeriesId?: number } = {},
) {
  const existing = await currentOperation(ctx, userId);
  if (existing && existing.phase !== "complete") {
    if (existing.kind === kind && (kind !== "import" || (existing.fingerprint === options.fingerprint && existing.mode === options.mode && (["movies", "tvSeries", "episodes"] as const).every(key => existing.expected[key] === options.expected?.[key]))) && existing.tvSeriesId === options.tvSeriesId) return existing._id;
    throw new Error("Another data operation is in progress. Finish or resume it in Settings first.");
  }
  if (existing) await ctx.db.delete(existing._id);
  const phase = kind === "export" ? "export" : kind === "import" ? "upload" : kind === "clear_movies" || kind === "account" ? "delete_movies" : "delete_episodes";
  const now = Date.now();
  const jobId = await ctx.db.insert("dataOperations", {
    userId, kind, phase, ...options, expected: options.expected ?? emptyCounts(),
    uploaded: emptyCounts(), inserted: emptyCounts(), updated: emptyCounts(),
    position: -1, revision: 0, processed: 0, deleted: 0,
    startedAt: now, expiresAt: now + idleLifetime, cursor: null,
  });
  if (phase === "upload" || phase === "export") {
    await ctx.scheduler.runAfter(idleLifetime, internal.dataOperations.expireIdle, { jobId });
  } else {
    await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId, revision: 0 });
  }
  return jobId;
}

export const current = query({
  args: {}, returns: v.union(jobDocument, v.null()),
  handler: async ctx => currentOperation(ctx, await requireOwner(ctx)),
});
export const status = query({
  args: jobArgs, returns: jobDocument, handler: ownedJobHandler,
});
async function ownedJobHandler(ctx: QueryCtx, args: { jobId: Id<"dataOperations"> }) {
  return ownedJob(ctx, args.jobId);
}
export const resume = mutation({
  args: jobArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (["upload", "export", "complete", "awaiting_identity"].includes(job.phase)) return null;
    await ctx.db.patch(job._id, { error: undefined });
    await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId: job._id, revision: job.revision });
    return null;
  },
});
export const cancelPreparation = mutation({
  args: jobArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.phase === "complete") return null;
    if (job.phase !== "upload" && job.phase !== "export") throw new Error("This operation has started changing data. Resume it to completion.");
    await ctx.db.patch(job._id, { phase: "cleanup", cancelled: true, revision: job.revision + 1 });
    await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId: job._id, revision: job.revision + 1 });
    return null;
  },
});
export const expireIdle = internalMutation({
  args: jobArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || (job.phase !== "upload" && job.phase !== "export")) return null;
    if (job.expiresAt > Date.now()) {
      await ctx.scheduler.runAfter(job.expiresAt - Date.now(), internal.dataOperations.expireIdle, args);
    } else {
      await ctx.db.patch(job._id, { phase: "cleanup", cancelled: true, revision: job.revision + 1 });
      await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId: job._id, revision: job.revision + 1 });
    }
    return null;
  },
});

async function applyRow(ctx: MutationCtx, job: Job, row: BackupRow) {
  const now = job.startedAt;
  const replace = job.mode === "replace";
  const counts = { ...job.inserted };
  const updates = { ...job.updated };
  if (row.kind === "movies") {
    const m = row.value;
    const existing = await ctx.db.query("userMovies").withIndex("by_user_movie", q => q.eq("userId", job.userId).eq("movieId", m.movieId)).unique();
    if (existing && !replace) {
      await ctx.db.patch(existing._id, { status: m.status, watchedDate: m.watchedDate ?? existing.watchedDate, runtime: m.runtime ?? existing.runtime, updatedAt: now });
    } else {
      const doc = { userId: job.userId, ...m, createdAt: m.createdAt ?? now, updatedAt: m.updatedAt ?? now };
      if (existing) await ctx.db.replace(existing._id, doc);
      else await ctx.db.insert("userMovies", doc);
    }
    if (existing && !replace) updates.movies++; else counts.movies++;
  } else if (row.kind === "tvSeries") {
    const t = row.value;
    const existing = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q => q.eq("userId", job.userId).eq("tvSeriesId", t.tvSeriesId)).unique();
    if (existing && !replace) await ctx.db.patch(existing._id, { status: t.status, updatedAt: now });
    else {
      // Imported dates are compatibility metadata, never watch evidence.
      const doc = { userId: job.userId, tvSeriesId: t.tvSeriesId, status: t.status, createdAt: t.createdAt ?? now, updatedAt: t.updatedAt ?? now };
      if (existing) await ctx.db.replace(existing._id, doc); else await ctx.db.insert("userTvSeries", doc);
    }
    if (existing && !replace) updates.tvSeries++; else counts.tvSeries++;
  } else {
    const e = row.value;
    const existing = await ctx.db.query("userEpisodes").withIndex("by_user_episode", q => q.eq("userId", job.userId).eq("episodeId", e.episodeId)).unique();
    if (existing && !replace) {
      await ctx.db.patch(existing._id, {
        tvSeriesId: e.tvSeriesId, seasonId: e.seasonId, isWatched: e.isWatched,
        watchedDate: e.watchedDate ?? (e.isWatched && existing.isWatched ? existing.watchedDate : undefined),
        runtime: e.runtime ?? existing.runtime, updatedAt: now,
      });
    } else {
      const doc = { userId: job.userId, ...e, createdAt: e.createdAt ?? now, updatedAt: e.updatedAt ?? now };
      if (existing) await ctx.db.replace(existing._id, doc); else await ctx.db.insert("userEpisodes", doc);
    }
    if (existing && !replace) updates.episodes++; else counts.episodes++;
  }
  job.inserted = counts;
  job.updated = updates;
}

// Pagination is a continuation, including when byte budgets produce short pages.
// Fixed-field imported records are small; existing cached stats can be ~1 MiB.
const pageOptions = (cursor: string | null) => ({ cursor, numItems: BATCH_SIZE, maximumRowsRead: BATCH_SIZE, maximumBytesRead: 1024 * 1024 });
async function flushSummary(ctx: MutationCtx, job: Job) {
  const s = job.summary;
  if (!s) return;
  const existing = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q => q.eq("userId", job.userId).eq("tvSeriesId", s.tvSeriesId)).unique();
  const summary = { startedAt: s.startedAt, lastWatchedAt: s.lastWatchedAt, seasonWatchedCounts: s.countsOverflow ? undefined : s.counts };
  if (existing) await ctx.db.patch(existing._id, summary);
  else await ctx.db.insert("userTvSeries", { userId: job.userId, tvSeriesId: s.tvSeriesId, status: "currently_watching", ...summary, createdAt: s.createdAt, updatedAt: s.updatedAt });
}

export const processBatch = internalMutation({
  args: checkpointArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.revision !== args.revision || job.error || ["upload", "export", "complete", "awaiting_identity"].includes(job.phase)) return null;
    const advance = (phase: Job["phase"]) => { job.phase = phase; job.cursor = null; };
    if (job.phase === "apply") {
      const rows = await ctx.db.query("dataImportRows").withIndex("by_job_position", q => q.eq("jobId", job._id).gt("position", job.position)).take(BATCH_SIZE);
      for (const row of rows) {
        await applyRow(ctx, job, row.row);
        job.position = row.position;
        job.processed++;
      }
      if (rows.length < BATCH_SIZE) advance(job.mode === "replace" ? "prune_movies" : "reset_summaries");
    } else if (["prune_movies", "prune_tv", "prune_episodes", "delete_movies", "delete_tv", "delete_episodes"].includes(job.phase)) {
      const isMovies = job.phase.endsWith("movies");
      const isTv = job.phase.endsWith("tv");
      const kind: BackupKind = isMovies ? "movies" : isTv ? "tvSeries" : "episodes";
      const page = isMovies
        ? await ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor))
        : isTv
          ? await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q => job.kind === "delete_series" ? q.eq("userId", job.userId).eq("tvSeriesId", job.tvSeriesId!) : q.eq("userId", job.userId)).paginate(pageOptions(job.cursor))
          : await ctx.db.query("userEpisodes").withIndex("by_user_tv", q => job.kind === "delete_series" ? q.eq("userId", job.userId).eq("tvSeriesId", job.tvSeriesId!) : q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const doc of page.page) {
        const key = "movieId" in doc ? doc.movieId : "episodeId" in doc ? doc.episodeId : doc.tvSeriesId;
        const retained = job.phase.startsWith("prune") && await ctx.db.query("dataImportRows").withIndex("by_job_kind_key", q => q.eq("jobId", job._id).eq("kind", kind).eq("key", key)).unique();
        if (!retained) { await ctx.db.delete(doc._id); job.deleted++; }
        job.processed++;
      }
      job.cursor = page.continueCursor;
      if (page.isDone) {
        if (job.phase === "prune_movies") advance("prune_tv");
        else if (job.phase === "prune_tv") advance("prune_episodes");
        else if (job.phase === "prune_episodes") advance("reset_summaries");
        else if (job.phase === "delete_movies") advance(job.kind === "account" ? "delete_episodes" : "delete_stats");
        else if (job.phase === "delete_episodes") advance("delete_tv");
        else advance("delete_stats");
      }
    } else if (job.phase === "reset_summaries") {
      const page = await ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const series of page.page) await ctx.db.patch(series._id, { startedAt: undefined, lastWatchedAt: undefined, seasonWatchedCounts: {}, catchUpVerifiedSeasons: undefined });
      job.processed += page.page.length;
      job.cursor = page.continueCursor;
      if (page.isDone) advance("summaries");
    } else if (job.phase === "summaries") {
      const page = await ctx.db.query("userEpisodes").withIndex("by_user_tv", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const ep of page.page) {
        if (!ep.isWatched) continue;
        if (job.summary?.tvSeriesId !== ep.tvSeriesId) {
          await flushSummary(ctx, job);
          job.summary = { tvSeriesId: ep.tvSeriesId, counts: {}, countsOverflow: false, createdAt: ep.createdAt, updatedAt: ep.updatedAt };
        }
        const s = job.summary!;
        s.createdAt = Math.min(s.createdAt, ep.createdAt);
        s.updatedAt = Math.max(s.updatedAt, ep.updatedAt);
        const key = String(ep.seasonId);
        // The legacy optional map cannot represent >1024 seasons. Preserve the
        // existing UI's "unknown count" fallback instead of truncating counts.
        if (!(key in s.counts) && Object.keys(s.counts).length === 1024) s.countsOverflow = true;
        if (!s.countsOverflow) s.counts[key] = (s.counts[key] ?? 0) + 1;
        if (ep.watchedDate !== undefined && isValidWatchDate(ep.watchedDate)) {
          s.startedAt = Math.min(s.startedAt ?? ep.watchedDate, ep.watchedDate);
          s.lastWatchedAt = Math.max(s.lastWatchedAt ?? ep.watchedDate, ep.watchedDate);
        }
      }
      job.processed += page.page.length;
      job.cursor = page.continueCursor;
      if (page.isDone) { await flushSummary(ctx, job); job.summary = undefined; advance("delete_stats"); }
    } else if (job.phase === "delete_stats") {
      const page = await ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(pageOptions(job.cursor));
      for (const row of page.page) await ctx.db.delete(row._id);
      job.cursor = page.continueCursor;
      if (page.isDone) advance("cleanup");
    } else if (job.phase === "cleanup") {
      const rows = await ctx.db.query("dataImportRows").withIndex("by_job_position", q => q.eq("jobId", job._id)).take(BATCH_SIZE);
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length < BATCH_SIZE) advance(job.kind === "account" ? "awaiting_identity" : "complete");
    }
    const { _id, _creationTime, ...fields } = job;
    void _creationTime;
    await ctx.db.replace(_id, { ...fields, revision: job.revision + 1 });
    if (job.phase !== "complete" && job.phase !== "awaiting_identity") await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId: _id, revision: job.revision + 1 });
    return null;
  },
});

// A subtransaction rolls a failed batch back before recording an actionable
// checkpoint error. Duplicate scheduled/resume calls use revision fences.
export const runBatch = internalMutation({
  args: checkpointArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.revision !== args.revision || job.error) return null;
    try {
      await ctx.runMutation(internal.dataOperations.processBatch, args, {
        transactionLimits: { databaseQueries: 1024, documentsRead: 4000, documentsWritten: 1000, bytesRead: 8 * 1024 * 1024, bytesWritten: 8 * 1024 * 1024 },
      });
    } catch (error) {
      await ctx.db.patch(job._id, { error: error instanceof Error ? error.message.slice(0, 500) : "Batch failed. Retry from Settings." });
    }
    return null;
  },
});
