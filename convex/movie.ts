import { query, mutation } from "./_generated/server";
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
    }
});

export const setMovieStatus = mutation({
    args: {
        movieId: v.number(),
        status: v.union(
            v.literal("want_to_watch"),
            v.literal("watched"),
            v.literal("on_hold"),
            v.literal("dropped")
        )
    },
    handler: async (ctx, args: { movieId: number; status: any }) => {
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
                updatedAt: now,
                watchedDate: args.status === "watched" ? now : existing.watchedDate
            });
            return { _id: existing._id, created: false, updated: true };
        }

        const _id = await ctx.db.insert("userMovies", {
            userId: identity.subject,
            movieId: args.movieId,
            status: args.status,
            createdAt: now,
            updatedAt: now,
            watchedDate: args.status === "watched" ? now : undefined
        });
        return { _id, created: true, updated: false };
    }
});
