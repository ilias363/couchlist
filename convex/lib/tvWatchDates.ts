import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export function isValidWatchDate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 8.64e15;
}

export function validateWatchDate(value: number | undefined): void {
  if (value !== undefined && !isValidWatchDate(value)) {
    throw new Error("Watch date must be a valid timestamp");
  }
}

export function deriveWatchSummary(
  episodes: Pick<Doc<"userEpisodes">, "seasonId" | "isWatched" | "watchedDate">[],
) {
  let startedAt: number | undefined;
  let lastWatchedAt: number | undefined;
  const seasonWatchedCounts: Record<string, number> = {};
  for (const episode of episodes) {
    if (!episode.isWatched) continue;
    const seasonId = String(episode.seasonId);
    seasonWatchedCounts[seasonId] = (seasonWatchedCounts[seasonId] ?? 0) + 1;
    const date = episode.watchedDate;
    if (date === undefined || !isValidWatchDate(date)) continue;
    if (startedAt === undefined || date < startedAt) startedAt = date;
    if (lastWatchedAt === undefined || date > lastWatchedAt) lastWatchedAt = date;
  }
  return { startedAt, lastWatchedAt, seasonWatchedCounts };
}

// Explicit read-only preflight diagnostic only. Mutations and bounded repairs
// must not use this full-history scan.
export function getSeriesEpisodes(ctx: QueryCtx, userId: string, tvSeriesId: number) {
  return ctx.db.query("userEpisodes").withIndex("by_user_tv", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).collect();
}

// Populated pre-incremental summaries are already authoritative. The version
// also distinguishes a repaired >1024-season map (intentionally unknown) from
// a legacy summary that must not be treated as empty.
export function hasWatchSummary(series: Doc<"userTvSeries">) {
  return series.seasonWatchedCounts !== undefined || series.watchSummaryVersion === 1;
}

export async function prepareSeriesWatchSummary(
  ctx: MutationCtx,
  userId: string,
  tvSeriesId: number,
) {
  const existing = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).unique();
  if (existing && hasWatchSummary(existing)) return existing;
  // Unwatched-only history has a known empty summary, even without a parent.
  // Include watched rows with unknown dates: those still represent progress.
  const episode = await ctx.db.query("userEpisodes").withIndex("by_userId_tvSeriesId_isWatched_watchedDate", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId).eq("isWatched", true)
  ).first();
  if (episode) {
    throw new Error("Watch progress needs repair before editing episodes. An administrator must repair this series; paused repairs can be resumed in Settings.");
  }
  const summary = { startedAt: undefined, lastWatchedAt: undefined, seasonWatchedCounts: {}, watchSummaryVersion: 1 as const };
  if (existing) {
    await ctx.db.patch(existing._id, summary);
    return { ...existing, ...summary };
  }
  const now = Date.now();
  const doc = { userId, tvSeriesId, status: "currently_watching" as const, ...summary, createdAt: now, updatedAt: now };
  const _id = await ctx.db.insert("userTvSeries", doc);
  return { ...doc, _id };
}

type EpisodeWatchState = Pick<Doc<"userEpisodes">, "seasonId" | "isWatched" | "watchedDate">;
type WatchChange = { before: EpisodeWatchState | null; after: EpisodeWatchState | null };
function recordedDate(episode: EpisodeWatchState | null) {
  const date = episode?.watchedDate;
  return episode?.isWatched && date !== undefined && isValidWatchDate(date) ? date : undefined;
}

// Call once AFTER the episode writes, in the same transaction. The parent read
// and patch serialize cross-tab edits; boundary reads see all of this batch's
// writes, including remaining episodes tied at the old min/max.
export async function applyEpisodeWatchChanges(
  ctx: MutationCtx,
  series: Pick<Doc<"userTvSeries">, "_id" | "userId" | "tvSeriesId" | "startedAt" | "lastWatchedAt" | "seasonWatchedCounts">,
  changes: WatchChange[],
) {
  let counts = series.seasonWatchedCounts === undefined ? undefined : { ...series.seasonWatchedCounts };
  let { startedAt, lastWatchedAt } = series;
  let findStart = false;
  let findEnd = false;
  const deltas: Record<string, number> = {};
  for (const { before, after } of changes) {
    if (before?.isWatched) deltas[before.seasonId] = (deltas[before.seasonId] ?? 0) - 1;
    if (after?.isWatched) deltas[after.seasonId] = (deltas[after.seasonId] ?? 0) + 1;
    const oldDate = recordedDate(before);
    const newDate = recordedDate(after);
    if (oldDate !== undefined && oldDate !== newDate) {
      findStart ||= oldDate === series.startedAt;
      findEnd ||= oldDate === series.lastWatchedAt;
    }
    if (newDate !== undefined) {
      startedAt = Math.min(startedAt ?? newDate, newDate);
      lastWatchedAt = Math.max(lastWatchedAt ?? newDate, newDate);
    }
  }
  if (counts !== undefined) {
    for (const [season, delta] of Object.entries(deltas)) {
      const count = (counts[season] ?? 0) + delta;
      if (count < 0) throw new Error("Watch progress is inconsistent; repair this series before editing episodes.");
      if (count === 0) delete counts[season];
      else counts[season] = count;
    }
    // Match batched import's existing unknown-progress fallback at the Convex
    // object limit. A later explicit repair can recover the map if it fits.
    if (Object.keys(counts).length > 1024) counts = undefined;
  }
  const boundary = async (order: "asc" | "desc") => {
    const episode = await ctx.db.query("userEpisodes")
      .withIndex("by_userId_tvSeriesId_isWatched_watchedDate", q =>
        q.eq("userId", series.userId).eq("tvSeriesId", series.tvSeriesId).eq("isWatched", true)
          .gte("watchedDate", -8.64e15).lte("watchedDate", 8.64e15)
      ).order(order).first();
    return episode?.watchedDate;
  };
  if (findStart) startedAt = await boundary("asc");
  if (findEnd) lastWatchedAt = await boundary("desc");
  await ctx.db.patch(series._id, { startedAt, lastWatchedAt, seasonWatchedCounts: counts, watchSummaryVersion: 1, updatedAt: Date.now() });
}

export function validateUniqueIds(ids: number[], label: string): void {
  const seen = new Set<number>();
  for (const id of ids) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid ${label} identifier`);
    if (seen.has(id)) throw new Error(`Duplicate ${label} identifier`);
    seen.add(id);
  }
}

export function validateEpisodeIdentity(
  episode: Doc<"userEpisodes"> | null,
  tvSeriesId: number,
  seasonId: number,
) {
  if (episode && (episode.tvSeriesId !== tvSeriesId || episode.seasonId !== seasonId)) {
    throw new Error("Episode belongs to a different series or season");
  }
}
