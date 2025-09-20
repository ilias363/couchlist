import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const getSeriesStatus = query({
  args: { tvSeriesId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_tv_series", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId)
      )
      .unique();
  },
});

export const setSeriesStatus = mutation({
  args: {
    tvSeriesId: v.number(),
    status: v.union(
      v.literal("want_to_watch"),
      v.literal("currently_watching"),
      v.literal("watched"),
      v.literal("on_hold"),
      v.literal("dropped")
    ),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const now = Date.now();
    const existing = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_tv_series", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
        watchedDate: args.status === "watched" ? args.watchedAt ?? now : existing.watchedDate,
      });
    } else {
      await ctx.db.insert("userTvSeries", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        status: args.status,
        startedDate: args.status === "currently_watching" ? now : undefined,
        watchedDate: args.status === "watched" ? args.watchedAt ?? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const getSeasonEpisodesStatus = query({
  args: { tvSeriesId: v.number(), seasonId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_season", q =>
        q.eq("userId", identity.subject).eq("seasonId", args.seasonId)
      )
      .collect();
  },
});

export const toggleEpisodeWatched = mutation({
  args: {
    tvSeriesId: v.number(),
    seasonId: v.number(),
    episodeId: v.number(),
    runtime: v.optional(v.number()),
    isWatched: v.boolean(),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_episode", q =>
        q.eq("userId", identity.subject).eq("episodeId", args.episodeId)
      )
      .unique();
    const now = Date.now();

    if (!args.isWatched) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        runtime: args.runtime ?? existing.runtime,
        isWatched: true,
        watchedDate: args.watchedAt ?? now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userEpisodes", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        seasonId: args.seasonId,
        episodeId: args.episodeId,
        runtime: args.runtime,
        isWatched: true,
        watchedDate: args.watchedAt ?? now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const bulkToggleSeasonEpisodes = mutation({
  args: {
    tvSeriesId: v.number(),
    seasonId: v.number(),
    episodesInfo: v.array(v.object({ episodeId: v.number(), runtime: v.optional(v.number()) })),
    isWatched: v.boolean(),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const now = Date.now();

    const existing = await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_season", q =>
        q.eq("userId", identity.subject).eq("seasonId", args.seasonId)
      )
      .collect();
    const existingMap = new Map(existing.map(e => [e.episodeId, e]));

    if (!args.isWatched) {
      for (const ep of args.episodesInfo) {
        const rec = existingMap.get(ep.episodeId);
        if (rec) {
          await ctx.db.delete(rec._id);
        }
      }
      return;
    }

    for (const ep of args.episodesInfo) {
      const rec = existingMap.get(ep.episodeId);
      if (rec) {
        await ctx.db.patch(rec._id, {
          runtime: ep.runtime ?? rec.runtime,
          isWatched: true,
          watchedDate: args.watchedAt ?? now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("userEpisodes", {
          userId: identity.subject,
          tvSeriesId: args.tvSeriesId,
          seasonId: args.seasonId,
          episodeId: ep.episodeId,
          runtime: ep.runtime,
          isWatched: true,
          watchedDate: args.watchedAt ?? now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const listUserTvSeries = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("want_to_watch"),
        v.literal("currently_watching"),
        v.literal("watched"),
        v.literal("on_hold"),
        v.literal("dropped")
      )
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const base = ctx.db.query("userTvSeries");
    const ordered = args.status
      ? base
        .withIndex("by_user_status_updatedAt", q =>
          q.eq("userId", identity.subject).eq("status", args.status!)
        )
        .order("desc")
      : base.withIndex("by_user_updatedAt", q => q.eq("userId", identity.subject)).order("desc");

    const page = await ordered.paginate(args.paginationOpts);
    return page;
  },
});

export const listAllTvStatuses = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};

    const userSeries = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    const result: Record<
      number,
      { status: "want_to_watch" | "watched" | "on_hold" | "dropped" | "currently_watching" }
    > = {};

    for (const tv of userSeries) {
      result[tv.tvSeriesId] = { status: tv.status };
    }

    return result;
  },
});

export const deleteTvSeries = mutation({
  args: { tvSeriesId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_tv_series", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const episodes = await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_tv", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId)
      )
      .collect();
    for (const ep of episodes) {
      await ctx.db.delete(ep._id);
    }

    return { deletedSeries: !!existing, deletedEpisodes: episodes.length };
  },
});

export const clearAllTvData = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [series, episodes] = await Promise.all([
      ctx.db
        .query("userTvSeries")
        .withIndex("by_user", q => q.eq("userId", identity.subject))
        .collect(),
      ctx.db
        .query("userEpisodes")
        .withIndex("by_user_tv", q => q.eq("userId", identity.subject))
        .collect(),
    ]);

    for (const s of series) {
      await ctx.db.delete(s._id);
    }
    for (const e of episodes) {
      await ctx.db.delete(e._id);
    }

    return { deletedSeries: series.length, deletedEpisodes: episodes.length };
  },
});
