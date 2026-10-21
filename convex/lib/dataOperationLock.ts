import type { MutationCtx, QueryCtx } from "../_generated/server";
import { invalidateStatsPass } from "./statsFence";

export async function currentOperation(ctx: QueryCtx, userId: string) {
  return ctx.db.query("dataOperations").withIndex("by_user", q => q.eq("userId", userId)).unique();
}
export async function requireOwner(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  // Existing CouchList records are keyed by the WorkOS subject. Keep that key;
  // it is derived exclusively from the verified JWT, never a caller argument.
  return identity.subject;
}
export async function assertDataWritable(ctx: MutationCtx, userId: string) {
  const job = await currentOperation(ctx, userId);
  if (job && job.phase !== "complete") {
    throw new Error("A data operation is in progress. Open Settings to finish or resume it before changing your library.");
  }
  await invalidateStatsPass(ctx, userId);
}

// Keep the guard separately testable without executing an account-ID migration.
export async function assertUserIdMigrationWritable(ctx: MutationCtx, oldUserId: string, newUserId: string) {
  await assertDataWritable(ctx, oldUserId);
  await assertDataWritable(ctx, newUserId);
}
