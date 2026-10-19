import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { validateUniqueIds } from "./lib/tvWatchDates";

const summary = v.object({
  tvSeriesId: v.number(),
  seasonWatchedCounts: v.optional(v.record(v.string(), v.number())),
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
    const result = await ctx.db.query("userTvSeries")
      .withIndex("by_user_status_updatedAt", q => q.eq("userId", identity.subject).eq("status", "up_to_date"))
      .order("desc").paginate({
        // Preserve all native options, tightening only the read budgets. Return
        // splitCursor/pageStatus unchanged so reactive pagination can split.
        ...paginationOpts,
        maximumRowsRead: Math.min(paginationOpts.maximumRowsRead ?? 50, 50),
        maximumBytesRead: Math.min(paginationOpts.maximumBytesRead ?? 512 * 1024, 512 * 1024),
      });
    return { ...result, page: result.page.map(({ tvSeriesId, seasonWatchedCounts }) => ({ tvSeriesId, seasonWatchedCounts })) };
  },
});

// Check only the candidate season's current TMDB IDs, never scan old history.
// Point reads also bound unusually large seasons and work without a backfill.
export const watchedIds = query({
  args: { tvSeriesId: v.number(), seasonId: v.number(), episodeIds: v.array(v.number()) },
  returns: v.array(v.number()),
  handler: async (ctx, { tvSeriesId, seasonId, episodeIds }) => {
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
