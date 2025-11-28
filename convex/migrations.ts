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
