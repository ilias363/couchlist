import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { assertDataWritable } from "./lib/dataOperationLock";
import { createOperation } from "./dataOperations";
import { EPISODE_BATCH_SIZE } from "../lib/tv-watch-batches";
import {
  applyEpisodeWatchChanges,
  prepareSeriesWatchSummary,
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await assertDataWritable(ctx, identity.subject);
    const now = Date.now();

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
      });
    } else {
      // A missing parent can have orphan history. Leave that progress unknown
      // until explicit repair; only an indexed empty-history probe permits {}.
      const episode = await ctx.db.query("userEpisodes").withIndex("by_user_tv", q =>
        q.eq("userId", identity.subject).eq("tvSeriesId", args.tvSeriesId)
      ).first();
      await ctx.db.insert("userTvSeries", {
        userId: identity.subject,
        tvSeriesId: args.tvSeriesId,
        status: args.status,
        ...(!episode ? { seasonWatchedCounts: {}, watchSummaryVersion: 1 as const } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await assertDataWritable(ctx, identity.subject);
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
        const series = await prepareSeriesWatchSummary(ctx, identity.subject, args.tvSeriesId);
        await ctx.db.delete(existing._id);
        await applyEpisodeWatchChanges(ctx, series, [{ before: existing, after: null }]);
      }
      return null;
    }

    const series = await prepareSeriesWatchSummary(ctx, identity.subject, args.tvSeriesId);
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

    await applyEpisodeWatchChanges(ctx, series, [{
      before: existing,
      after: { seasonId: args.seasonId, isWatched: true, watchedDate: args.watchedAt },
    }]);
    return null;
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await assertDataWritable(ctx, identity.subject);
    const now = Date.now();

    if (args.episodesInfo.length > EPISODE_BATCH_SIZE) throw new Error(`At most ${EPISODE_BATCH_SIZE} episodes per batch`);
    validateWatchDate(args.watchedAt);
    validateUniqueIds(
      args.episodesInfo.map(ep => ep.episodeId),
      "episode",
    );
    if (!args.episodesInfo.length) return null;
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
    if (!args.isWatched && records.every(record => record === null)) return null;
    const series = await prepareSeriesWatchSummary(ctx, identity.subject, args.tvSeriesId);

    if (!args.isWatched) {
      for (const rec of records) {
        if (rec) {
          await ctx.db.delete(rec._id);
        }
      }
      await applyEpisodeWatchChanges(ctx, series, records.map(before => ({ before, after: null })));
      return null;
    }

    for (const [i, ep] of args.episodesInfo.entries()) {
      const rec = records[i];
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

    await applyEpisodeWatchChanges(ctx, series, records.map(before => ({
      before,
      after: { seasonId: args.seasonId, isWatched: true, watchedDate: before?.isWatched ? before.watchedDate : args.watchedAt },
    })));
    return null;
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
      status: s.status,
    }));
  },
});

export const deleteTvSeries = mutation({
  args: { tvSeriesId: v.number() }, returns: v.id("dataOperations"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    validateUniqueIds([args.tvSeriesId], "series");
    return createOperation(ctx, identity.subject, "delete_series", { tvSeriesId: args.tvSeriesId });
  },
});

export const clearAllTvData = mutation({
  args: {}, returns: v.id("dataOperations"),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return createOperation(ctx, identity.subject, "clear_tv");
  },
});
