import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateUniqueIds } from "./lib/tvWatchDates";
import { currentOperation } from "./lib/dataOperationLock";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";

function summariesReady(job: Doc<"dataOperations"> | null) {
  return !job || job.phase === "complete" || job.phase === "upload" ||
    job.kind === "export" || job.kind === "clear_movies" || !!job.cancelled;
}

export const isReady = query({
  args: {}, returns: v.boolean(),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    return !!identity && summariesReady(await currentOperation(ctx, identity.subject));
  },
});

const summary = v.object({
  tvSeriesId: v.number(),
  seasonWatchedCounts: v.optional(v.record(v.string(), v.number())),
  catchUpVerifiedSeasons: schema.tables.userTvSeries.validator.fields.catchUpVerifiedSeasons,
  summariesReady: v.boolean(),
});

// One indexed page, with no episode-history reads. A journal/endCursor can
// outgrow numItems as rows change, so cap reads as well as requested page size.
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(summary),
  handler: async (ctx, { paginationOpts }) => {
    if (!Number.isInteger(paginationOpts.numItems) || paginationOpts.numItems < 1 || paginationOpts.numItems > 50) {
      throw new Error("Request between 1 and 50 shows");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };
    const ready = summariesReady(await currentOperation(ctx, identity.subject));
    const result = await ctx.db.query("userTvSeries")
      .withIndex("by_user_status_updatedAt", q => q.eq("userId", identity.subject).eq("status", "up_to_date"))
      .order("desc").paginate({
        // Preserve all native options, tightening only the read budgets. Return
        // splitCursor/pageStatus unchanged so reactive pagination can split.
        ...paginationOpts,
        maximumRowsRead: Math.min(paginationOpts.maximumRowsRead ?? 50, 50),
        maximumBytesRead: Math.min(paginationOpts.maximumBytesRead ?? 512 * 1024, 512 * 1024),
      });
    return { ...result, page: result.page.map(({ tvSeriesId, seasonWatchedCounts, catchUpVerifiedSeasons }) => ({
      tvSeriesId, summariesReady: ready,
      seasonWatchedCounts: ready ? seasonWatchedCounts : undefined,
      catchUpVerifiedSeasons: ready ? catchUpVerifiedSeasons : undefined,
    })) };
  },
});

// Check only the candidate season's current TMDB IDs, never scan old history.
// Point reads also bound unusually large seasons and work without a backfill.
export const watchedIds = query({
  args: { tvSeriesId: v.number(), seasonId: v.number(), episodeIds: v.array(v.number()), retry: v.optional(v.number()) },
  returns: v.array(v.number()),
  handler: async (ctx, { tvSeriesId, seasonId, episodeIds, retry }) => {
    // Partition the actual Convex subscription on an explicit retry. Changing
    // only useQueries' local identifier would retain its cached failed watch.
    if (retry !== undefined && (!Number.isSafeInteger(retry) || retry < 0)) throw new Error("Invalid retry");
    if (episodeIds.length > 100) throw new Error("Request at most 100 episodes");
    validateUniqueIds([tvSeriesId], "series");
    validateUniqueIds([seasonId], "season");
    validateUniqueIds(episodeIds, "episode");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const episodes = await Promise.all(episodeIds.map(episodeId => ctx.db.query("userEpisodes")
      .withIndex("by_user_episode", q => q.eq("userId", identity.subject).eq("episodeId", episodeId)).unique()));
    return episodes.flatMap(ep => ep?.isWatched && ep.tvSeriesId === tvSeriesId && ep.seasonId === seasonId ? [ep.episodeId] : []);
  },
});

// Revoke the exact evidence contradicted by observed TMDB metadata. A stale
// client must not remove a newer verification saved by another tab.
export const revokeVerifications = mutation({
  args: { tvSeriesId: v.number(), seasons: v.array(v.object({
    seasonId: v.number(), episodeCount: v.number(), airDate: v.union(v.string(), v.null()),
    watchedCount: v.union(v.number(), v.null()),
  })) },
  returns: v.null(),
  handler: async (ctx, { tvSeriesId, seasons }) => {
    if (!seasons.length || seasons.length > 100) throw new Error("Revoke between 1 and 100 seasons");
    validateUniqueIds([tvSeriesId], "series");
    validateUniqueIds(seasons.map(s => s.seasonId), "season");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const series = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
      q.eq("userId", identity.subject).eq("tvSeriesId", tvSeriesId)).unique();
    if (!series?.catchUpVerifiedSeasons) return null;
    const proofs = { ...series.catchUpVerifiedSeasons };
    let changed = false;
    for (const { seasonId, ...expected } of seasons) {
      const proof = proofs[String(seasonId)];
      if (proof && proof.episodeCount === expected.episodeCount && proof.airDate === expected.airDate && proof.watchedCount === expected.watchedCount) {
        delete proofs[String(seasonId)]; changed = true;
      }
    }
    if (changed) await ctx.db.patch(series._id, { catchUpVerifiedSeasons: proofs });
    return null;
  },
});

// A count alone cannot prove completeness after TMDB removes an episode. Save
// small, per-user evidence only after rechecking the entire supplied inventory
// atomically. Watch changes invalidate affected proof, including same-time writes.
export const verifySeasons = mutation({
  args: { tvSeriesId: v.number(), seasons: v.array(v.object({
    seasonId: v.number(), airDate: v.union(v.string(), v.null()), episodeIds: v.array(v.number()),
  })) },
  returns: v.boolean(),
  handler: async (ctx, { tvSeriesId, seasons }) => {
    const ids = seasons.flatMap(s => s.episodeIds);
    if (!seasons.length || !ids.length || ids.length > 100 || seasons.some(s => !s.episodeIds.length)) throw new Error("Verify between 1 and 100 episodes");
    validateUniqueIds([tvSeriesId], "series");
    validateUniqueIds(seasons.map(s => s.seasonId), "season");
    validateUniqueIds(ids, "episode");
    if (seasons.some(s => s.airDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.airDate))) throw new Error("Invalid season date");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const job = await currentOperation(ctx, identity.subject);
    if (job && job.phase !== "complete") return false;
    const series = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
      q.eq("userId", identity.subject).eq("tvSeriesId", tvSeriesId)).unique();
    if (!series || series.status !== "up_to_date") return false;
    const proofs = { ...series.catchUpVerifiedSeasons };
    for (const season of seasons) {
      for (const episodeId of season.episodeIds) {
        const episode = await ctx.db.query("userEpisodes").withIndex("by_user_episode", q =>
          q.eq("userId", identity.subject).eq("episodeId", episodeId)).unique();
        if (!episode?.isWatched || episode.tvSeriesId !== tvSeriesId || episode.seasonId !== season.seasonId) return false;
      }
      proofs[String(season.seasonId)] = {
        episodeCount: season.episodeIds.length, airDate: season.airDate,
        watchedCount: series.seasonWatchedCounts ? series.seasonWatchedCounts[String(season.seasonId)] ?? 0 : null,
      };
    }
    const refreshed = new Set(seasons.map(s => String(s.seasonId)));
    for (const key of Object.keys(proofs)) {
      if (Object.keys(proofs).length <= 100) break;
      if (!refreshed.has(key)) delete proofs[key];
    }
    await ctx.db.patch(series._id, { catchUpVerifiedSeasons: proofs });
    return true;
  },
});
