import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createOperation, ownedJob } from "./dataOperations";
import { requireOwner } from "./lib/dataOperationLock";
import { BATCH_SIZE, backupKind, backupRow, recordCounts, parseRow, rowKey } from "./lib/backupFormat";

const jobArgs = { jobId: v.id("dataOperations") };
export const startExport = mutation({
  args: {}, returns: v.id("dataOperations"),
  handler: async ctx => createOperation(ctx, await requireOwner(ctx), "export"),
});
export const exportData = query({
  args: { ...jobArgs, kind: backupKind, paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(backupRow), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.kind !== "export" || job.phase !== "export") throw new Error("Export expired. Start a new download.");
    const opts = args.paginationOpts;
    if (!Number.isInteger(opts.numItems) || opts.numItems < 1 || opts.numItems > BATCH_SIZE || !opts.maximumRowsRead || opts.maximumRowsRead > BATCH_SIZE || !opts.maximumBytesRead || opts.maximumBytesRead > 1024 * 1024) throw new Error("Export page exceeds budget");
    const result = args.kind === "movies"
      ? await ctx.db.query("userMovies").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(opts)
      : args.kind === "tvSeries"
        ? await ctx.db.query("userTvSeries").withIndex("by_user", q => q.eq("userId", job.userId)).paginate(opts)
        : await ctx.db.query("userEpisodes").withIndex("by_user_tv", q => q.eq("userId", job.userId)).paginate(opts);
    const page = result.page.map(doc => {
      const { userId, _id, _creationTime, ...value } = doc;
      void userId; void _id; void _creationTime;
      if ("seasonWatchedCounts" in value) delete value.seasonWatchedCounts;
      if ("catchUpVerifiedSeasons" in value) delete value.catchUpVerifiedSeasons;
      if ("watchSummaryVersion" in value) delete value.watchSummaryVersion;
      return parseRow(args.kind, value);
    });
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
export const finishExport = mutation({
  args: jobArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.kind !== "export") throw new Error("Not an export");
    if (job.cancelled || (job.phase !== "export" && job.phase !== "complete")) throw new Error("Export expired. Start a new download.");
    await ctx.db.patch(job._id, { phase: "complete" });
    return null;
  },
});
export const startImport = mutation({
  args: { schema: v.literal("couchlist.export"), version: v.literal(1), mode: v.union(v.literal("merge"), v.literal("replace")), fingerprint: v.string(), expected: recordCounts },
  returns: v.id("dataOperations"),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx);
    if (!/^[a-f0-9]{64}$/.test(args.fingerprint)) throw new Error("Invalid file fingerprint");
    for (const count of Object.values(args.expected)) if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid record count");
    return createOperation(ctx, userId, "import", { mode: args.mode, fingerprint: args.fingerprint, expected: args.expected });
  },
});
export const stageImport = mutation({
  args: { ...jobArgs, offset: v.number(), rows: v.array(backupRow) }, returns: v.number(),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.kind !== "import" || job.phase !== "upload") throw new Error("This import is no longer accepting upload batches");
    if (!Number.isSafeInteger(args.offset) || args.offset < 0 || args.rows.length < 1 || args.rows.length > BATCH_SIZE) throw new Error("Invalid upload batch");
    const total = job.uploaded.movies + job.uploaded.tvSeries + job.uploaded.episodes;
    if (args.offset > total || (args.offset < total && args.offset + args.rows.length > total)) throw new Error("Upload checkpoint mismatch. Reselect the same file to resume.");
    for (const [i, input] of args.rows.entries()) {
      const row = parseRow(input.kind, input.value);
      const key = rowKey(row);
      if (args.offset < total) {
        const existing = await ctx.db.query("dataImportRows").withIndex("by_job_position", q => q.eq("jobId", job._id).eq("position", args.offset + i)).unique();
        if (!existing || JSON.stringify(parseRow(existing.row.kind, existing.row.value)) !== JSON.stringify(row)) throw new Error("Retried batch differs from the staged file");
        continue;
      }
      const duplicate = await ctx.db.query("dataImportRows").withIndex("by_job_kind_key", q => q.eq("jobId", job._id).eq("kind", row.kind).eq("key", key)).unique();
      if (duplicate) throw new Error(`Duplicate ${row.kind} identifier`);
      if (++job.uploaded[row.kind] > job.expected[row.kind]) throw new Error("Upload exceeds declared record count");
      await ctx.db.insert("dataImportRows", { jobId: job._id, position: args.offset + i, kind: row.kind, key, row });
    }
    await ctx.db.patch(job._id, { uploaded: job.uploaded, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return args.offset < total ? total : total + args.rows.length;
  },
});
export const sealImport = mutation({
  args: jobArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.kind !== "import") throw new Error("Not an import");
    if (job.phase !== "upload") return null;
    for (const kind of ["movies", "tvSeries", "episodes"] as const) if (job.uploaded[kind] !== job.expected[kind]) throw new Error("The full backup must be uploaded and validated before import can start");
    await ctx.db.patch(job._id, { phase: "apply", revision: job.revision + 1 });
    await ctx.scheduler.runAfter(0, internal.dataOperations.runBatch, { jobId: job._id, revision: job.revision + 1 });
    return null;
  },
});
