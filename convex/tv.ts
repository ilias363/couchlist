import { mutation, query } from "./_generated/server";
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
