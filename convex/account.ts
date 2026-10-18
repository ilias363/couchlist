import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { createOperation } from "./dataOperations";
import { requireOwner } from "./lib/dataOperationLock";

// Retain this minimal deletion fence after cleanup, including when WorkOS fails
// or an old JWT is still valid. All library, stats and staging rows are removed
// before awaiting_identity; the fence prevents data resurrection during retry.
export const deleteAccountData = mutation({
  args: {}, returns: v.id("dataOperations"),
  handler: async ctx => createOperation(ctx, await requireOwner(ctx), "account"),
});
