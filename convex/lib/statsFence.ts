import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export function currentStatsJob(ctx: QueryCtx, userId: string) {
  return ctx.db.query("statsRebuilds").withIndex("by_user", q => q.eq("userId", userId)).unique();
}

// Called in the SAME transaction as every ordinary library write. A pass can
// publish only if no relevant write occurred from its first page to its last.
export async function invalidateStatsPass(ctx: MutationCtx, userId: string) {
  const job = await currentStatsJob(ctx, userId);
  if (job && job.status !== "complete" && !job.sourceChanged) await ctx.db.patch(job._id, { sourceChanged: true });
}

// Deleting the checkpoint fences queued callbacks. Garbage collection never
// creates a checkpoint/snapshot. New passes get new IDs, isolating old callbacks.
export async function cancelStatsPass(ctx: MutationCtx, userId: string) {
  const job = await currentStatsJob(ctx, userId);
  if (!job) return;
  await ctx.db.delete(job._id);
  await ctx.scheduler.runAfter(0, internal.stats.cleanupFacts, { jobId: job._id });
}
