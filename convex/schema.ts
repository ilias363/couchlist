// convex/schema.js
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User Movie Tracking - tracks user's movie watch status
  userMovies: defineTable({
    userId: v.string(),
    movieId: v.number(), // TMDB movie ID
    status: v.union(
      v.literal("want_to_watch"),
      v.literal("watched"),
      v.literal("on_hold"),
      v.literal("dropped")
    ),
    watchedDate: v.optional(v.number()),
    runtime: v.optional(v.number()), // In minutes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_movie", ["userId", "movieId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_watched_date", ["userId", "watchedDate"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_status_updatedAt", ["userId", "status", "updatedAt"]),

  // User TV Series Tracking - tracks user's TV series watch status
  userTvSeries: defineTable({
    userId: v.string(),
    tvSeriesId: v.number(), // TMDB TV series ID
    status: v.union(
      v.literal("want_to_watch"),
      v.literal("currently_watching"),
      v.literal("watched"),
      v.literal("on_hold"),
      v.literal("dropped")
    ),
    startedDate: v.optional(v.number()), // When started watching
    watchedDate: v.optional(v.number()), // When completed/dropped
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tv_series", ["userId", "tvSeriesId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_watched_date", ["userId", "watchedDate"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_status_updatedAt", ["userId", "status", "updatedAt"]),

  // User Episode Tracking - tracks individual episode watch status
  userEpisodes: defineTable({
    userId: v.string(),
    tvSeriesId: v.number(), // TMDB TV series ID
    seasonId: v.number(), // TMDB season ID
    episodeId: v.number(), // TMDB episode ID
    isWatched: v.boolean(),
    watchedDate: v.optional(v.number()),
    runtime: v.optional(v.number()), // In minutes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tv_series", ["userId", "tvSeriesId"])
    .index("by_user_season", ["userId", "seasonId"])
    .index("by_user_episode", ["userId", "episodeId"])
    .index("by_user_watched", ["userId", "isWatched"]),
});
