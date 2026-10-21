// convex/schema.js
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { backupRow, recordCounts } from "./lib/backupFormat";
import { statsValidator } from "./lib/statsModel";

export default defineSchema({
  // One current operation per account. This row is also the transaction fence
  // read by normal writers. Import rows remain durable until recovery finishes.
  dataOperations: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("export"), v.literal("import"), v.literal("clear_movies"), v.literal("clear_tv"), v.literal("delete_series"), v.literal("account"), v.literal("repair_tv")),
    phase: v.union(v.literal("upload"), v.literal("export"), v.literal("apply"), v.literal("prune_movies"), v.literal("prune_tv"), v.literal("prune_episodes"), v.literal("reset_summaries"), v.literal("summaries"), v.literal("delete_movies"), v.literal("delete_tv"), v.literal("delete_episodes"), v.literal("delete_stats"), v.literal("delete_stats_work"), v.literal("cleanup"), v.literal("complete"), v.literal("awaiting_identity")),
    mode: v.optional(v.union(v.literal("merge"), v.literal("replace"))),
    fingerprint: v.optional(v.string()),
    expected: recordCounts,
    uploaded: recordCounts,
    inserted: recordCounts,
    updated: recordCounts,
    position: v.number(), revision: v.number(), processed: v.number(), deleted: v.number(),
    startedAt: v.number(), expiresAt: v.number(),
    cursor: v.union(v.string(), v.null()),
    tvSeriesId: v.optional(v.number()),
    backfillCursor: v.optional(v.string()), // Continue the legacy global backfill only after this repair completes.
    error: v.optional(v.string()),
    cancelled: v.optional(v.boolean()),
    summary: v.optional(v.object({
      tvSeriesId: v.number(), startedAt: v.optional(v.number()), lastWatchedAt: v.optional(v.number()),
      counts: v.record(v.string(), v.number()), countsOverflow: v.boolean(),
      createdAt: v.number(), updatedAt: v.number(),
    })),
  }).index("by_user", ["userId"]),
  dataImportRows: defineTable({
    jobId: v.id("dataOperations"), position: v.number(),
    kind: v.union(v.literal("movies"), v.literal("tvSeries"), v.literal("episodes")),
    key: v.number(), row: backupRow,
  })
    .index("by_job_position", ["jobId", "position"])
    .index("by_job_kind_key", ["jobId", "kind", "key"]),
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
      v.literal("up_to_date"),
      v.literal("on_hold"),
      v.literal("dropped")
    ),
    // New field names
    startedAt: v.optional(v.number()), // First valid recorded date among watched episodes
    lastWatchedAt: v.optional(v.number()), // Last valid recorded date among watched episodes
    seasonWatchedCounts: v.optional(v.record(v.string(), v.number())), // TMDB season ID -> watched count
    // Bounded catch-up evidence, not a copy of TMDB inventories. Watch changes
    // invalidate affected seasons; import summary resets clear the evidence.
    catchUpVerifiedSeasons: v.optional(v.record(v.string(), v.object({
      episodeCount: v.number(), airDate: v.union(v.string(), v.null()),
      watchedCount: v.union(v.number(), v.null()),
    }))),
    watchSummaryVersion: v.optional(v.literal(1)), // Includes intentionally unknown (>1024 season) counts.
    // Old field names (to be removed after migration)
    // startedDate: v.optional(v.number()), // @deprecated - use startedAt
    // watchedDate: v.optional(v.number()), // @deprecated - use lastWatchedAt
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tv_series", ["userId", "tvSeriesId"])
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
    .index("by_user_tv", ["userId", "tvSeriesId"])
    .index("by_user_season", ["userId", "seasonId"])
    .index("by_user_episode", ["userId", "episodeId"])
    .index("by_userId_tvSeriesId_isWatched_watchedDate", ["userId", "tvSeriesId", "isWatched", "watchedDate"])
    .index("by_user_watched", ["userId", "isWatched"]),

  // User Stats Caching - stores computed stats to reduce compute
  userStats: defineTable({
    userId: v.string(),
    stats: v.any(), // Stores the full stats object
    lastRefreshed: v.number(),
  }).index("by_user", ["userId"]),

  // Only new, initially empty tables need indexes; existing history needs no
  // index backfill. One current checkpoint per owner, fixed-size accumulator.
  statsRebuilds: defineTable({
    userId: v.string(),
    status: v.union(v.literal("running"), v.literal("failed"), v.literal("complete")),
    phase: v.union(v.literal("movies"), v.literal("tv"), v.literal("episodes"), v.literal("streaks"), v.literal("cleanup")),
    revision: v.number(), cursor: v.union(v.string(), v.null()),
    stats: statsValidator, processed: v.number(), restarts: v.number(),
    sourceChanged: v.boolean(), updatedAt: v.number(),
    previousDay: v.optional(v.number()), error: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  // Arbitrarily many unique days/seasons never enter one Convex value. The
  // ordered day index supports a streaming streak reduction; cleanup is paged.
  statsFacts: defineTable({
    userId: v.string(), jobId: v.id("statsRebuilds"),
    kind: v.union(v.literal("day"), v.literal("season")), key: v.number(),
  }).index("by_job_kind_key", ["jobId", "kind", "key"]).index("by_user", ["userId"]),
});
