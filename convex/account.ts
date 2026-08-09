import { mutation } from "./_generated/server";

export const deleteAccountData = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const [movies, tvSeries, episodes, stats] = await Promise.all([
      ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", userId)).collect(),
      ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", userId)).collect(),
      ctx.db.query("userEpisodes").withIndex("by_user_tv", q => q.eq("userId", userId)).collect(),
      ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", userId)).collect(),
    ]);

    const documents = [...movies, ...tvSeries, ...episodes, ...stats];
    for (const document of documents) {
      await ctx.db.delete(document._id);
    }

    return { deleted: documents.length };
  },
});
