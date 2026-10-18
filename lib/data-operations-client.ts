import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BATCH_SIZE, type Backup, type BackupRow } from "@/convex/lib/backupFormat";
import type { ImportMode } from "./types";
import type { Id } from "@/convex/_generated/dataModel";

export async function waitForDataOperation(client: ConvexReactClient, jobId: Id<"dataOperations">) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const job = await client.query(api.dataOperations.status, { jobId });
    if (job.error) throw new Error(`Data deletion paused: ${job.error}. Resume it in Settings.`);
    if (job.phase === "complete") return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Data deletion continues in the background. Check progress in Settings.");
}

export async function downloadBackup(client: ConvexReactClient, progress: (count: number) => void) {
  const jobId = await client.mutation(api.importExport.startExport, {});
  try {
    const parts: BlobPart[] = [`{"schema":"couchlist.export","version":1,"exportedAt":${Date.now()}`];
    let count = 0;
    for (const kind of ["movies", "tvSeries", "episodes"] as const) {
      parts.push(`,"${kind}":[`);
      let cursor: string | null = null;
      let first = true;
      for (;;) {
        const page: { page: BackupRow[]; isDone: boolean; continueCursor: string } = await client.query(api.importExport.exportData, {
          jobId, kind,
          paginationOpts: { cursor, numItems: BATCH_SIZE, maximumRowsRead: BATCH_SIZE, maximumBytesRead: 1024 * 1024 },
        });
        for (const row of page.page) {
          parts.push(`${first ? "" : ","}${JSON.stringify(row.value)}`);
          first = false;
        }
        count += page.page.length;
        progress(count);
        if (page.isDone) break;
        if (cursor === page.continueCursor) throw new Error("Export cursor did not advance. Please retry the download.");
        cursor = page.continueCursor;
      }
      parts.push("]");
    }
    parts.push("}");
    const blob = new Blob(parts, { type: "application/json;charset=utf-8" });
    await client.mutation(api.importExport.finishExport, { jobId });
    return blob;
  } catch (error) {
    await client.mutation(api.dataOperations.cancelPreparation, { jobId }).catch(() => {});
    throw error;
  }
}

export async function uploadBackup(client: ConvexReactClient, backup: Backup, fingerprint: string, mode: ImportMode) {
  const jobId = await client.mutation(api.importExport.startImport, {
    schema: backup.schema, version: backup.version, mode, fingerprint,
    expected: { movies: backup.movies.length, tvSeries: backup.tvSeries.length, episodes: backup.episodes.length },
  });
  const job = await client.query(api.dataOperations.status, { jobId });
  if (job.phase !== "upload") {
    await client.mutation(api.dataOperations.resume, { jobId });
    return;
  }
  let offset = job.uploaded.movies + job.uploaded.tvSeries + job.uploaded.episodes;
  let position = 0;
  let batch: BackupRow[] = [];
  for (const kind of ["movies", "tvSeries", "episodes"] as const) {
    for (const value of backup[kind]) {
      if (position++ < offset) continue;
      batch.push({ kind, value } as BackupRow);
      if (batch.length === BATCH_SIZE) {
        offset = await client.mutation(api.importExport.stageImport, { jobId, offset, rows: batch });
        batch = [];
      }
    }
  }
  if (batch.length) await client.mutation(api.importExport.stageImport, { jobId, offset, rows: batch });
  await client.mutation(api.importExport.sealImport, { jobId });
}
