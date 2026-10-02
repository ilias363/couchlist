import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  deriveWatchDates,
  getSeriesEpisodes,
  refreshSeriesWatchDates,
  validateWatchDate,
  validateUniqueIds,
  validateEpisodeIdentity,
} from "./lib/tvWatchDates";

const tvStatusValidator = v.union(
  v.literal("want_to_watch"),
  v.literal("currently_watching"),
  v.literal("watched"),
  v.literal("up_to_date"),
  v.literal("on_hold"),
  v.literal("dropped"),
);

export const getSeriesStatus = query({
  args: { tvSeriesId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_tv_series", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId),
      )
      .unique();
  },
});

export const setSeriesStatus = mutation({
  args: {
    tvSeriesId: v.number(),
    status: tvStatusValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const now = Date.now();

    const dates = deriveWatchDates(
      await getSeriesEpisodes(ctx, identity.subject, args.tvSeriesId),
    );

    const existing = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_tv_series", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
        ...dates,
      });
    } else {
      // New series: derive dates from episodes (could be undefined)
      await ctx.db.insert("userTvSeries", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        status: args.status,
        ...dates,
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
        q.eq("userId", identity.subject).eq("seasonId", args.seasonId),
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
        q.eq("userId", identity.subject).eq("episodeId", args.episodeId),
      )
      .unique();
    validateWatchDate(args.watchedAt);
    validateEpisodeIdentity(existing, args.tvSeriesId, args.seasonId);
    const now = Date.now();

    if (!args.isWatched) {
      if (existing) {
        await ctx.db.delete(existing._id);
        // Update the TV series dates after removing episode
        await refreshSeriesWatchDates(ctx, identity.subject, args.tvSeriesId);
      }
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        runtime: args.runtime ?? existing.runtime,
        isWatched: true,
        watchedDate: args.watchedAt,
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
        watchedDate: args.watchedAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Recompute after explicit individual date changes.
    await refreshSeriesWatchDates(ctx, identity.subject, args.tvSeriesId);
  },
});

export const bulkToggleSeasonEpisodes = mutation({
  args: {
    tvSeriesId: v.number(),
    seasonId: v.number(),
    episodesInfo: v.array(
      v.object({ episodeId: v.number(), runtime: v.optional(v.number()) }),
    ),
    isWatched: v.boolean(),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const now = Date.now();

    validateWatchDate(args.watchedAt);
    validateUniqueIds(
      args.episodesInfo.map(ep => ep.episodeId),
      "episode",
    );
    if (!args.episodesInfo.length) return;
    // Resolve global episode identities before writing, including other seasons.
    const records = await Promise.all(
      args.episodesInfo.map(ep =>
        ctx.db
          .query("userEpisodes")
          .withIndex("by_user_episode", q =>
            q.eq("userId", identity.subject).eq("episodeId", ep.episodeId),
          )
          .unique(),
      ),
    );
    for (const record of records)
      validateEpisodeIdentity(record, args.tvSeriesId, args.seasonId);
    const existingMap = new Map(
      records
        .filter(record => record !== null)
        .map(record => [record.episodeId, record]),
    );

    if (!args.isWatched) {
      for (const ep of args.episodesInfo) {
        const rec = existingMap.get(ep.episodeId);
        if (rec) {
          await ctx.db.delete(rec._id);
        }
      }
      // Update the TV series dates after removing episodes
      await refreshSeriesWatchDates(ctx, identity.subject, args.tvSeriesId);
      return;
    }

    for (const ep of args.episodesInfo) {
      const rec = existingMap.get(ep.episodeId);
      if (rec) {
        await ctx.db.patch(rec._id, {
          runtime: ep.runtime ?? rec.runtime,
          isWatched: true,
          watchedDate: rec.isWatched ? rec.watchedDate : args.watchedAt,
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
          watchedDate: args.watchedAt,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Refresh once after all writes, including unknown dates.
    await refreshSeriesWatchDates(ctx, identity.subject, args.tvSeriesId);
  },
});

export const listUserTvSeries = query({
  args: {
    status: v.optional(tvStatusValidator),
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
            q.eq("userId", identity.subject).eq("status", args.status!),
          )
          .order("desc")
      : base
          .withIndex("by_user_updatedAt", q => q.eq("userId", identity.subject))
          .order("desc");

    const page = await ordered.paginate(args.paginationOpts);
    return page;
  },
});

export const getRecentTvByStatus = query({
  args: {
    statuses: v.array(tvStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const max = args.limit ?? 20;
    const statuses = Array.from(new Set(args.statuses));

    if (statuses.length === 0) return [];

    const groups = await Promise.all(
      statuses.map(status =>
        ctx.db
          .query("userTvSeries")
          .withIndex("by_user_status_updatedAt", q =>
            q.eq("userId", identity.subject).eq("status", status),
          )
          .order("desc")
          .take(max),
      ),
    );

    const items = groups
      .flat()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, max);

    return items.map(s => ({
      tvSeriesId: s.tvSeriesId,
      updatedAt: s.updatedAt,
    }));
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
      {
        status:
          | "want_to_watch"
          | "watched"
          | "on_hold"
          | "dropped"
          | "currently_watching"
          | "up_to_date";
      }
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
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const episodes = await ctx.db
      .query("userEpisodes")
      .withIndex("by_user_tv", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId),
      )
      .collect();
    for (const ep of episodes) {
      await ctx.db.delete(ep._id);
    }

    return { deletedSeries: !!existing, deletedEpisodes: episodes.length };
  },
});

export const getUpToDateSeriesWithEpisodes = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const upToDateSeries = await ctx.db
      .query("userTvSeries")
      .withIndex("by_user_status_updatedAt", q =>
        q.eq("userId", identity.subject).eq("status", "up_to_date"),
      )
      .collect();

    const results = await Promise.all(
      upToDateSeries.map(async series => {
        const episodes = await ctx.db
          .query("userEpisodes")
          .withIndex("by_user_tv", q =>
            q
              .eq("userId", identity.subject)
              .eq("tvSeriesId", series.tvSeriesId),
          )
          .collect();

        const watchedEpisodeIds = episodes
          .filter(ep => ep.isWatched)
          .map(ep => ep.episodeId);

        return {
          tvSeriesId: series.tvSeriesId,
          watchedEpisodeIds,
        };
      }),
    );

    return results;
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
