import { v, type Infer } from "convex/values";

export const BATCH_SIZE = 100;
export const backupKind = v.union(v.literal("movies"), v.literal("tvSeries"), v.literal("episodes"));
const times = { createdAt: v.optional(v.number()), updatedAt: v.optional(v.number()) };
export const movieItem = v.object({
  movieId: v.number(),
  status: v.union(v.literal("want_to_watch"), v.literal("watched"), v.literal("on_hold"), v.literal("dropped")),
  watchedDate: v.optional(v.number()), runtime: v.optional(v.number()), ...times,
});
export const tvItem = v.object({
  tvSeriesId: v.number(),
  status: v.union(v.literal("want_to_watch"), v.literal("currently_watching"), v.literal("watched"), v.literal("up_to_date"), v.literal("on_hold"), v.literal("dropped")),
  startedAt: v.optional(v.number()), lastWatchedAt: v.optional(v.number()), ...times,
});
export const episodeItem = v.object({
  tvSeriesId: v.number(), seasonId: v.number(), episodeId: v.number(), isWatched: v.boolean(),
  watchedDate: v.optional(v.number()), runtime: v.optional(v.number()), ...times,
});
export const backupRow = v.union(
  v.object({ kind: v.literal("movies"), value: movieItem }),
  v.object({ kind: v.literal("tvSeries"), value: tvItem }),
  v.object({ kind: v.literal("episodes"), value: episodeItem }),
);
export const recordCounts = v.object({ movies: v.number(), tvSeries: v.number(), episodes: v.number() });
export type BackupRow = Infer<typeof backupRow>;
export type BackupKind = Infer<typeof backupKind>;
export type Backup = {
  schema: "couchlist.export"; version: 1; exportedAt?: number;
  movies: Infer<typeof movieItem>[]; tvSeries: Infer<typeof tvItem>[]; episodes: Infer<typeof episodeItem>[];
};
export function rowKey(row: BackupRow) {
  return row.kind === "movies" ? row.value.movieId : row.kind === "tvSeries" ? row.value.tvSeriesId : row.value.episodeId;
}

// Shared trust-boundary validation. Only fixed numeric/boolean/enum fields leave
// the browser; whole backup arrays never cross a Convex function boundary.
export function parseRow(kind: BackupKind, input: unknown): BackupRow {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`Invalid ${kind} record`);
  const obj = input as Record<string, unknown>;
  const fields = kind === "movies" ? movieItem.fields : kind === "tvSeries" ? tvItem.fields : episodeItem.fields;
  if (Object.keys(obj).some(key => !Object.prototype.hasOwnProperty.call(fields, key))) throw new Error(`Unexpected ${kind} field`);
  const value: Record<string, number | string | boolean> = {};
  for (const [key, validator] of Object.entries(fields)) {
    const item = obj[key];
    if (item === undefined && validator.isOptional === "optional") continue;
    if (key === "status") {
      const statuses = kind === "movies" ? ["want_to_watch", "watched", "on_hold", "dropped"] : ["want_to_watch", "currently_watching", "watched", "up_to_date", "on_hold", "dropped"];
      if (typeof item !== "string" || !statuses.includes(item)) throw new Error("Invalid status");
    } else if (key === "isWatched") {
      if (typeof item !== "boolean") throw new Error("Invalid episode watch status");
    } else {
      if (typeof item !== "number" || !Number.isFinite(item)) throw new Error(`Invalid ${key}`);
      if (key.endsWith("Id") && (!Number.isSafeInteger(item) || item <= 0)) throw new Error(`Invalid ${key}`);
      if (["watchedDate", "startedAt", "lastWatchedAt"].includes(key) && Math.abs(item) > 8.64e15) throw new Error("Watch date must be a valid timestamp");
    }
    value[key] = item as number | string | boolean;
  }
  return { kind, value } as BackupRow;
}
export function parseBackup(input: unknown): Backup {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid backup");
  const obj = input as Record<string, unknown>;
  if (obj.schema !== "couchlist.export") throw new Error("This file doesn't look like a CouchList backup.");
  if (obj.version !== 1) throw new Error(`Unsupported backup version: ${String(obj.version)}`);
  const parsed = { schema: "couchlist.export", version: 1 } as Backup;
  for (const kind of ["movies", "tvSeries", "episodes"] as const) {
    const items = obj[kind] === undefined ? [] : obj[kind];
    if (!Array.isArray(items)) throw new Error(`Invalid ${kind} array`);
    const seen = new Set<number>();
    const rows = items.map(item => {
      const row = parseRow(kind, item);
      const key = rowKey(row);
      if (seen.has(key)) throw new Error(`Duplicate ${kind} identifier`);
      seen.add(key);
      return row.value;
    });
    Object.assign(parsed, { [kind]: rows });
  }
  return parsed;
}
