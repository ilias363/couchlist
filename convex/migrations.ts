import { mutation } from "./_generated/server";
import { v } from "convex/values";

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

// Migration to recalculate TV series startedDate and watchedDate from episode watch dates
export const recalculateTvSeriesDates = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting TV series dates recalculation migration...");

    // Get all TV series
    const allSeries = await ctx.db.query("userTvSeries").collect();
    console.log(`Found ${allSeries.length} TV series to process`);

    let updated = 0;
    let skipped = 0;
    const now = Date.now();

    for (const series of allSeries) {
      // Get all episodes for this series and user
      const episodes = await ctx.db
        .query("userEpisodes")
        .withIndex("by_user_tv", (q) =>
          q.eq("userId", series.userId).eq("tvSeriesId", series.tvSeriesId)
        )
        .collect();

      // Extract dates from episodes
      const dates = episodes
        .filter((ep) => ep.watchedDate !== undefined)
        .map((ep) => ep.watchedDate!);

      if (dates.length === 0) {
        skipped++;
        continue;
      }

      const earliest = Math.min(...dates);
      const latest = Math.max(...dates);

      const updates: { startedDate?: number; watchedDate?: number; updatedAt: number } = {
        updatedAt: now,
        startedDate: earliest,
      };

      updates.watchedDate = latest;

      await ctx.db.patch(series._id, updates);
      updated++;
    }

    const result = {
      success: true,
      totalProcessed: allSeries.length,
      updated,
      skipped,
    };

    console.log("Migration complete:", result);
    return result;
  },
});
