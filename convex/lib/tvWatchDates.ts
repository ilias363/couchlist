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

export function deriveWatchDates(episodes: Pick<Doc<"userEpisodes">, "isWatched" | "watchedDate">[]) {
  let startedAt: number | undefined;
  let lastWatchedAt: number | undefined;
  for (const episode of episodes) {
    const date = episode.watchedDate;
    if (!episode.isWatched || date === undefined || !isValidWatchDate(date)) continue;
    if (startedAt === undefined || date < startedAt) startedAt = date;
    if (lastWatchedAt === undefined || date > lastWatchedAt) lastWatchedAt = date;
  }
  return { startedAt, lastWatchedAt };
}

export function getSeriesEpisodes(ctx: QueryCtx, userId: string, tvSeriesId: number) {
  return ctx.db.query("userEpisodes").withIndex("by_user_tv", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).collect();
}

// Individual watching can explicitly clear a date. Bulk watching preserves dates
// on already-watched rows; both recompute the bounds from the resulting history.
export async function refreshSeriesWatchDates(
  ctx: MutationCtx,
  userId: string,
  tvSeriesId: number,
  repair = false,
) {
  const existing = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).unique();
  const episodes = await getSeriesEpisodes(ctx, userId, tvSeriesId);
  const dates = deriveWatchDates(episodes);
  if (existing) {
    const changed = existing.startedAt !== dates.startedAt || existing.lastWatchedAt !== dates.lastWatchedAt;
    if (!repair || changed) {
      // Convex patch removes fields explicitly set to undefined.
      await ctx.db.patch(existing._id, { ...dates, ...(!repair ? { updatedAt: Date.now() } : {}) });
    }
    return changed ? "updated" : "unchanged";
  }
  const watched = episodes.filter(ep => ep.isWatched);
  if (!watched.length) return "unchanged";
  let createdAt = Date.now();
  let updatedAt = createdAt;
  if (repair) {
    createdAt = watched[0].createdAt;
    updatedAt = watched[0].updatedAt;
    for (const episode of watched) {
      createdAt = Math.min(createdAt, episode.createdAt);
      updatedAt = Math.max(updatedAt, episode.updatedAt);
    }
  }
  await ctx.db.insert("userTvSeries", {
    userId, tvSeriesId, status: "currently_watching", ...dates, createdAt, updatedAt,
  });
  return "created";
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
