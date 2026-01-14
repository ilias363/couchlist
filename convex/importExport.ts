import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const exportData = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;

    const [movies, tvSeries, episodes] = await Promise.all([
      ctx.db
        .query("userMovies")
        .withIndex("by_user", q => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userTvSeries")
        .withIndex("by_user", q => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userEpisodes")
        .withIndex("by_user_tv", q => q.eq("userId", userId))
        .collect(),
    ]);

    const payload = {
      schema: "couchlist.export",
      version: 1,
      exportedAt: Date.now(),
      movies: movies.map(m => ({
        movieId: m.movieId,
        status: m.status,
        watchedDate: m.watchedDate,
        runtime: m.runtime,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      tvSeries: tvSeries.map(t => ({
        tvSeriesId: t.tvSeriesId,
        status: t.status,
        startedAt: t.startedAt,
        lastWatchedAt: t.lastWatchedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      episodes: episodes.map(e => ({
        tvSeriesId: e.tvSeriesId,
        seasonId: e.seasonId,
        episodeId: e.episodeId,
        isWatched: e.isWatched,
        watchedDate: e.watchedDate,
        runtime: e.runtime,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    };

    return payload;
  },
});

const MovieItem = v.object({
  movieId: v.number(),
  status: v.union(
    v.literal("want_to_watch"),
    v.literal("watched"),
    v.literal("on_hold"),
    v.literal("dropped")
  ),
  watchedDate: v.optional(v.number()),
  runtime: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

const TvItem = v.object({
  tvSeriesId: v.number(),
  status: v.union(
    v.literal("want_to_watch"),
    v.literal("currently_watching"),
    v.literal("watched"),
    v.literal("up_to_date"),
    v.literal("on_hold"),
    v.literal("dropped")
  ),
  startedAt: v.optional(v.number()),
  lastWatchedAt: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

const EpisodeItem = v.object({
  tvSeriesId: v.number(),
  seasonId: v.number(),
  episodeId: v.number(),
  isWatched: v.boolean(),
  watchedDate: v.optional(v.number()),
  runtime: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

export const importData = mutation({
  args: {
    payload: v.object({
      schema: v.string(),
      version: v.number(),
      exportedAt: v.optional(v.number()),
      movies: v.optional(v.array(MovieItem)),
      tvSeries: v.optional(v.array(TvItem)),
      episodes: v.optional(v.array(EpisodeItem)),
    }),
    mode: v.optional(v.union(v.literal("merge"), v.literal("replace"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const now = Date.now();

    if (args.payload.schema !== "couchlist.export") {
      throw new Error("Invalid backup schema");
    }
    if (args.payload.version !== 1) {
      throw new Error(`Unsupported backup version: ${args.payload.version}`);
    }

    const mode = args.mode ?? "merge";

    // If replace, delete all existing user docs first.
    if (mode === "replace") {
      const [movies, series, episodes] = await Promise.all([
        ctx.db
          .query("userMovies")
          .withIndex("by_user", q => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("userTvSeries")
          .withIndex("by_user", q => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("userEpisodes")
          .withIndex("by_user_tv", q => q.eq("userId", userId).gte("tvSeriesId", 0))
          .collect(),
      ]);
      await Promise.all([
        ...movies.map(m => ctx.db.delete(m._id)),
        ...series.map(t => ctx.db.delete(t._id)),
        ...episodes.map(e => ctx.db.delete(e._id)),
      ]);
    }

    let moviesInserted = 0;
    let moviesUpdated = 0;
    let tvInserted = 0;
    let tvUpdated = 0;
    let epInserted = 0;
    let epUpdated = 0;

    // Upsert movies
    for (const m of args.payload.movies ?? []) {
      const existing =
        mode === "replace"
          ? null
          : await ctx.db
            .query("userMovies")
            .withIndex("by_user_movie", q => q.eq("userId", userId).eq("movieId", m.movieId))
            .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: m.status,
          watchedDate: m.watchedDate ?? existing.watchedDate,
          runtime: m.runtime ?? existing.runtime,
          updatedAt: now,
        });
        moviesUpdated++;
      } else {
        await ctx.db.insert("userMovies", {
          userId,
          movieId: m.movieId,
          status: m.status,
          watchedDate: m.watchedDate,
          runtime: m.runtime,
          createdAt: m.createdAt ?? now,
          updatedAt: m.updatedAt ?? now,
        });
        moviesInserted++;
      }
    }

    // Upsert tv series
    for (const t of args.payload.tvSeries ?? []) {
      const existing =
        mode === "replace"
          ? null
          : await ctx.db
            .query("userTvSeries")
            .withIndex("by_user_tv_series", q =>
              q.eq("userId", userId).eq("tvSeriesId", t.tvSeriesId)
            )
            .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: t.status,
          startedAt: t.startedAt ?? existing.startedAt,
          lastWatchedAt: t.lastWatchedAt ?? existing.lastWatchedAt,
          updatedAt: now,
        });
        tvUpdated++;
      } else {
        await ctx.db.insert("userTvSeries", {
          userId,
          tvSeriesId: t.tvSeriesId,
          status: t.status,
          startedAt: t.startedAt,
          lastWatchedAt: t.lastWatchedAt,
          createdAt: t.createdAt ?? now,
          updatedAt: t.updatedAt ?? now,
        });
        tvInserted++;
      }
    }

    // Upsert episodes
    for (const e of args.payload.episodes ?? []) {
      const existing =
        mode === "replace"
          ? null
          : await ctx.db
            .query("userEpisodes")
            .withIndex("by_user_episode", q =>
              q.eq("userId", userId).eq("episodeId", e.episodeId)
            )
            .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          tvSeriesId: e.tvSeriesId,
          seasonId: e.seasonId,
          isWatched: e.isWatched,
          watchedDate: e.watchedDate ?? existing.watchedDate,
          runtime: e.runtime ?? existing.runtime,
          updatedAt: now,
        });
        epUpdated++;
      } else {
        await ctx.db.insert("userEpisodes", {
          userId,
          tvSeriesId: e.tvSeriesId,
          seasonId: e.seasonId,
          episodeId: e.episodeId,
          isWatched: e.isWatched,
          watchedDate: e.watchedDate,
          runtime: e.runtime,
          createdAt: e.createdAt ?? now,
          updatedAt: e.updatedAt ?? now,
        });
        epInserted++;
      }
    }

    return {
      mode,
      movies: {
        inserted: moviesInserted,
        updated: moviesUpdated,
        total: (args.payload.movies ?? []).length,
      },
      tvSeries: {
        inserted: tvInserted,
        updated: tvUpdated,
        total: (args.payload.tvSeries ?? []).length,
      },
      episodes: {
        inserted: epInserted,
        updated: epUpdated,
        total: (args.payload.episodes ?? []).length,
      },
    };
  },
});
