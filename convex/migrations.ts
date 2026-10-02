import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { deriveWatchDates, getSeriesEpisodes, isValidWatchDate, refreshSeriesWatchDates } from "./lib/tvWatchDates";

// Two independent cursor passes. Read-only, and deployable on the old version
export const preflightTvSeriesDates = internalQuery({
  args: {
    pass: v.union(v.literal("series"), v.literal("episodes")),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Page limit must be 1-500");
    const counts = {
      summaryOnlyDates: 0, mismatchedBounds: 0, emptyDateSummaries: 0,
      invalidSummaryDates: 0, invalidEpisodeDates: 0,
      missingParents: 0, duplicateSeriesGroups: 0, duplicateEpisodeGroups: 0,
    };
    const candidates: { userId: string; tvSeriesId: number }[] = [];
    let maxSeriesEpisodes = 0;
    if (args.pass === "series") {
      const page = await ctx.db.query("userTvSeries").paginate({ cursor: args.cursor, numItems: limit });
      for (const series of page.page) {
        const matches = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
          q.eq("userId", series.userId).eq("tvSeriesId", series.tvSeriesId)
        ).take(2);
        if (matches.length > 1 && matches[0]._id === series._id) counts.duplicateSeriesGroups++;
        const episodes = await getSeriesEpisodes(ctx, series.userId, series.tvSeriesId);
        maxSeriesEpisodes = Math.max(maxSeriesEpisodes, episodes.length);
        const dates = deriveWatchDates(episodes);
        const hasSummary = series.startedAt !== undefined || series.lastWatchedAt !== undefined;
        if (hasSummary && dates.startedAt === undefined) {
          counts.emptyDateSummaries++;
          if (!episodes.some(ep => ep.isWatched)) counts.summaryOnlyDates++;
        }
        for (const date of [series.startedAt, series.lastWatchedAt]) {
          if (date !== undefined && !isValidWatchDate(date)) counts.invalidSummaryDates++;
        }
        if (series.startedAt !== dates.startedAt || series.lastWatchedAt !== dates.lastWatchedAt) counts.mismatchedBounds++;
        candidates.push({ userId: series.userId, tvSeriesId: series.tvSeriesId });
      }
      return { isDone: page.isDone, continueCursor: page.continueCursor, scanned: page.page.length, counts, candidates, maxSeriesEpisodes };
    }
    const page = await ctx.db.query("userEpisodes").paginate({ cursor: args.cursor, numItems: limit });
    const seen = new Set<string>();
    for (const episode of page.page) {
      if (episode.watchedDate !== undefined && !isValidWatchDate(episode.watchedDate)) counts.invalidEpisodeDates++;
      const matches = await ctx.db.query("userEpisodes").withIndex("by_user_episode", q =>
        q.eq("userId", episode.userId).eq("episodeId", episode.episodeId)
      ).take(2);
      if (matches.length > 1 && matches[0]._id === episode._id) counts.duplicateEpisodeGroups++;
      if (!episode.isWatched) continue;
      const key = JSON.stringify([episode.userId, episode.tvSeriesId]);
      if (seen.has(key)) continue;
      seen.add(key);
      const parent = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
        q.eq("userId", episode.userId).eq("tvSeriesId", episode.tvSeriesId)
      ).first();
      if (parent) continue;
      candidates.push({ userId: episode.userId, tvSeriesId: episode.tvSeriesId });
      // Count each orphan group at its first watched row, even across pages.
      const firstWatched = await ctx.db.query("userEpisodes").withIndex("by_user_tv", q =>
        q.eq("userId", episode.userId).eq("tvSeriesId", episode.tvSeriesId)
      ).filter(q => q.eq(q.field("isWatched"), true)).first();
      if (firstWatched?._id === episode._id) {
        counts.missingParents++;
        maxSeriesEpisodes = Math.max(maxSeriesEpisodes, (await getSeriesEpisodes(ctx, episode.userId, episode.tvSeriesId)).length);
      }
    }
    return { isDone: page.isDone, continueCursor: page.continueCursor, scanned: page.page.length, counts, candidates, maxSeriesEpisodes };
  },
});

// One series per transaction: current reads and writes conflict with concurrent
// episode mutations. A stale discovery cannot recreate deleted watch history.
export const repairTvSeriesDates = internalMutation({
  args: { userId: v.string(), tvSeriesId: v.number() },
  handler: async (ctx, args) => {
    const series = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
      q.eq("userId", args.userId).eq("tvSeriesId", args.tvSeriesId)
    ).take(2);
    if (series.length > 1) throw new Error("Repair blocked: duplicate series identities; reconcile explicitly");
    const episodes = await getSeriesEpisodes(ctx, args.userId, args.tvSeriesId);
    for (const episode of episodes) {
      const matches = await ctx.db.query("userEpisodes").withIndex("by_user_episode", q =>
        q.eq("userId", args.userId).eq("episodeId", episode.episodeId)
      ).take(2);
      if (matches.length > 1) throw new Error("Repair blocked: duplicate episode identities; reconcile explicitly");
    }
    return { result: await refreshSeriesWatchDates(ctx, args.userId, args.tvSeriesId, true), episodeCount: episodes.length };
  },
});

export const replaceUserId = mutation({
  args: {
    oldUserId: v.string(),
    newUserId: v.string()
  },
  handler: async (ctx, { oldUserId, newUserId }) => {
    console.log(`Starting userId migration from ${oldUserId} to ${newUserId}`);

    // Update userMovies
    const movies = await ctx.db
      .query("userMovies")
      .withIndex("by_user", (q) => q.eq("userId", oldUserId))
      .collect();

    for (const movie of movies) {
      await ctx.db.patch(movie._id, { userId: newUserId });
    }
    console.log(`Updated ${movies.length} userMovies records`);

    // Update userTvSeries
    const tvSeries = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user", (q) => q.eq("userId", oldUserId))
      .collect();

    for (const series of tvSeries) {
      await ctx.db.patch(series._id, { userId: newUserId });
    }
    console.log(`Updated ${tvSeries.length} userTvSeries records`);

    // Update userEpisodes
    const episodes = await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_tv", (q) => q.eq("userId", oldUserId))
      .collect();

    for (const episode of episodes) {
      await ctx.db.patch(episode._id, { userId: newUserId });
    }
    console.log(`Updated ${episodes.length} userEpisodes records`);

    // Update userStats
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", oldUserId))
      .collect();

    for (const stat of stats) {
      await ctx.db.patch(stat._id, { userId: newUserId });
    }
    console.log(`Updated ${stats.length} userStats records`);

    const result = {
      success: true,
      moviesUpdated: movies.length,
      tvSeriesUpdated: tvSeries.length,
      episodesUpdated: episodes.length,
      statsUpdated: stats.length,
      totalUpdated: movies.length + tvSeries.length + episodes.length + stats.length,
    };

    console.log("Migration complete:", result);
    return result;
  },
});

// Migration to rename TV series date fields from startedDate/watchedDate to startedAt/lastWatchedAt
// Step 1: Deploy schema with both old and new fields
// Step 2: Run this migration: npx convex run migrations:renameTvSeriesDateFields
// Step 3: Deploy schema with only new fields (remove startedDate and watchedDate)
// export const renameTvSeriesDateFields = mutation({
//   args: {},
//   handler: async (ctx) => {
//     console.log("Starting TV series date field rename migration...");

//     const allSeries = await ctx.db.query("userTvSeries").collect();
//     console.log(`Found ${allSeries.length} TV series to process`);

//     let migrated = 0;
//     let alreadyMigrated = 0;
//     const now = Date.now();

//     for (const series of allSeries) {
//       // With the transitional schema, we can access both old and new fields
//       const hasOldFields = series.startedDate !== undefined || series.watchedDate !== undefined;
//       const hasNewFields = series.startedAt !== undefined || series.lastWatchedAt !== undefined;

//       // Skip if already migrated (has new fields but no old fields)
//       if (hasNewFields && !hasOldFields) {
//         alreadyMigrated++;
//         continue;
//       }

//       // Copy old values to new fields and clear old fields
//       if (hasOldFields) {
//         await ctx.db.patch(series._id, {
//           // Copy to new fields (prefer new value if already exists)
//           startedAt: series.startedAt ?? series.startedDate,
//           lastWatchedAt: series.lastWatchedAt ?? series.watchedDate,
//           // Clear old fields
//           startedDate: undefined,
//           watchedDate: undefined,
//           updatedAt: now,
//         });
//         migrated++;
//       }
//     }

//     const result = {
//       success: true,
//       totalProcessed: allSeries.length,
//       migrated,
//       alreadyMigrated,
//     };

//     console.log("Migration complete:", result);
//     return result;
//   },
// });
