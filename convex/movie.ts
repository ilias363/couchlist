import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { assertDataWritable } from "./lib/dataOperationLock";
import { createOperation } from "./dataOperations";

const movieStatusValidator = v.union(
  v.literal("want_to_watch"),
  v.literal("watched"),
  v.literal("on_hold"),
  v.literal("dropped")
);

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
    status: movieStatusValidator,
    runtime: v.optional(v.number()),
    watchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await assertDataWritable(ctx, identity.subject);

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
    status: v.optional(movieStatusValidator),
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

export const getRecentMoviesByStatus = query({
  args: {
    statuses: v.array(movieStatusValidator),
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
          .query("userMovies")
          .withIndex("by_user_status_updatedAt", q =>
            q.eq("userId", identity.subject).eq("status", status)
          )
          .order("desc")
          .take(max)
      )
    );

    const items = groups.flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);

    return items.map(m => ({ movieId: m.movieId, updatedAt: m.updatedAt, status: m.status }));
  },
});

export const deleteMovie = mutation({
  args: { movieId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await assertDataWritable(ctx, identity.subject);

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
  args: {}, returns: v.id("dataOperations"),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return createOperation(ctx, identity.subject, "clear_movies");
  },
});
