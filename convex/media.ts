import { v } from "convex/values";
import { query } from "./_generated/server";
import { STATUS_BATCH_SIZE } from "../lib/media-statuses";

const mediaTypeValidator = v.union(v.literal("movie"), v.literal("tv"));
const statusValidator = v.union(
  v.literal("want_to_watch"),
  v.literal("currently_watching"),
  v.literal("watched"),
  v.literal("up_to_date"),
  v.literal("on_hold"),
  v.literal("dropped"),
);

export const getStatuses = query({
  args: { items: v.array(v.object({ id: v.number(), mediaType: mediaTypeValidator })) },
  returns: v.array(v.object({ id: v.number(), mediaType: mediaTypeValidator, status: statusValidator })),
  handler: async (ctx, { items }) => {
    if (items.length > STATUS_BATCH_SIZE) {
      throw new Error(`Request at most ${STATUS_BATCH_SIZE} titles per status batch`);
    }
    if (items.some(item => !Number.isSafeInteger(item.id) || item.id <= 0)) {
      throw new Error("Title IDs must be positive integers");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const unique = new Map(items.map(item => [`${item.mediaType}:${item.id}`, item]));
    const records = await Promise.all([...unique.values()].map(async item => {
      const record = item.mediaType === "movie"
        ? await ctx.db.query("userMovies")
          .withIndex("by_user_movie", q => q.eq("userId", identity.subject).eq("movieId", item.id))
          .unique()
        : await ctx.db.query("userTvSeries")
          .withIndex("by_user_tv_series", q => q.eq("userId", identity.subject).eq("tvSeriesId", item.id))
          .unique();
      return record ? { ...item, status: record.status } : null;
    }));
    return records.filter(record => record !== null);
  },
});

export const hasTrackedItems = query({
  args: {},
  returns: v.boolean(),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    // Match the existing WorkOS subject-based ownership keys; no library scan.
    const [movie, tv] = await Promise.all([
      ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", identity.subject)).first(),
      ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", identity.subject)).first(),
    ]);
    return movie !== null || tv !== null;
  },
});
