import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const getMovieStatus = query({
  args: { movieId: v.number() },
  handler: async (ctx, args: { movieId: number }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const record = await ctx.db
      .query("userMovies")
      .withIndex("by_user_movie", q => q.eq("userId", identity.subject).eq("movieId", args.movieId))
      .unique();

    return record;
  },
});

export const setMovieStatus = mutation({
  args: {
    movieId: v.number(),
    status: v.union(
      v.literal("want_to_watch"),
      v.literal("watched"),
      v.literal("on_hold"),
      v.literal("dropped")
    ),
    runtime: v.optional(v.number()),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const now = Date.now();

    const existing = await ctx.db
      .query("userMovies")
      .withIndex("by_user_movie", q => q.eq("userId", identity.subject).eq("movieId", args.movieId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        runtime: args.runtime ?? existing.runtime,
        updatedAt: now,
        watchedDate: args.status === "watched" ? args.watchedAt : existing.watchedDate,
      });
      return { _id: existing._id, created: false, updated: true };
    }

    const _id = await ctx.db.insert("userMovies", {
      userId: identity.subject,
      movieId: args.movieId,
      status: args.status,
      runtime: args.runtime,
      createdAt: now,
      updatedAt: now,
      watchedDate: args.status === "watched" ? args.watchedAt : undefined,
    });
    return { _id, created: true, updated: false };
  },
});

export const listUserMovies = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("want_to_watch"),
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

    const base = ctx.db.query("userMovies");
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

export const listAllMovieStatuses = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};

    const userMovies = await ctx.db
      .query("userMovies")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    const result: Record<number, { status: "want_to_watch" | "watched" | "on_hold" | "dropped" }> =
      {};

    for (const m of userMovies) {
      result[m.movieId] = { status: m.status };
    }

    return result;
  },
});

export const deleteMovie = mutation({
  args: { movieId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("userMovies")
      .withIndex("by_user_movie", q => q.eq("userId", identity.subject).eq("movieId", args.movieId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }
    return { deleted: false };
  },
});

export const clearAllMovies = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const all = await ctx.db
      .query("userMovies")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    for (const m of all) {
      await ctx.db.delete(m._id);
    }

    return { deleted: all.length };
  },
});
