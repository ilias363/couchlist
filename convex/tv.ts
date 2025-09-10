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
        watchedDate: args.status === "watched" ? now : existing.watchedDate,
      });
    } else {
      await ctx.db.insert("userTvSeries", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        status: args.status,
        startedDate: args.status === "currently_watching" ? now : undefined,
        watchedDate: args.status === "watched" ? now : undefined,
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
    if (existing) {
      await ctx.db.patch(existing._id, {
        runtime: args.runtime ?? existing.runtime,
        isWatched: args.isWatched,
        watchedDate: args.isWatched ? now : undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userEpisodes", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        seasonId: args.seasonId,
        episodeId: args.episodeId,
        runtime: args.runtime,
        isWatched: args.isWatched,
        watchedDate: args.isWatched ? now : undefined,
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

    for (const ep of args.episodesInfo) {
      const rec = existingMap.get(ep.episodeId);
      if (rec) {
        await ctx.db.patch(rec._id, {
          runtime: ep.runtime ?? rec.runtime,
          isWatched: args.isWatched,
          watchedDate: args.isWatched ? now : undefined,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("userEpisodes", {
          userId: identity.subject,
          tvSeriesId: args.tvSeriesId,
          seasonId: args.seasonId,
          episodeId: ep.episodeId,
          runtime: ep.runtime,
          isWatched: args.isWatched,
          watchedDate: args.isWatched ? now : undefined,
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
  }
});

export const listAllTvStatuses = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {} as Record<number, { status: string }>;

    const userSeries = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    const result: Record<number, { status: string }> = {};

    for (const tv of userSeries) {
      result[tv.tvSeriesId] = { status: tv.status };
    }

    return result;
  }
});
