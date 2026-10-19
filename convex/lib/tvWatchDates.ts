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

export function getSeriesEpisodes(ctx: QueryCtx, userId: string, tvSeriesId: number) {
  return ctx.db.query("userEpisodes").withIndex("by_user_tv", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).collect();
}

// Watch mutations add or remove IDs; retain evidence only for seasons whose
// verified watched count still matches. An unwatch followed by a rewatch cannot
// resurrect removed proof, even if both writes share the same timestamp.
export function retainCatchUpVerifications(series: Doc<"userTvSeries">, counts: Record<string, number>) {
  const proofs = Object.fromEntries(Object.entries(series.catchUpVerifiedSeasons ?? {}).filter(
    ([seasonId, proof]) => proof.watchedCount !== null && proof.watchedCount === (counts[seasonId] ?? 0),
  ));
  return Object.keys(proofs).length ? proofs : undefined;
}

// Individual watching can explicitly clear a date. Bulk watching preserves dates
// on already-watched rows; both rebuild the summary from the resulting history.
export async function refreshSeriesWatchSummary(
  ctx: MutationCtx,
  userId: string,
  tvSeriesId: number,
  repair = false,
) {
  const existing = await ctx.db.query("userTvSeries").withIndex("by_user_tv_series", q =>
    q.eq("userId", userId).eq("tvSeriesId", tvSeriesId)
  ).unique();
  const episodes = await getSeriesEpisodes(ctx, userId, tvSeriesId);
  const summary = deriveWatchSummary(episodes);
  if (existing) {
    const counts = existing.seasonWatchedCounts;
    const changed = existing.startedAt !== summary.startedAt ||
      existing.lastWatchedAt !== summary.lastWatchedAt ||
      counts === undefined ||
      Object.keys(counts).length !== Object.keys(summary.seasonWatchedCounts).length ||
      Object.entries(summary.seasonWatchedCounts).some(([seasonId, count]) => counts[seasonId] !== count);
    if (!repair || changed) {
      // Convex patch removes fields explicitly set to undefined.
      await ctx.db.patch(existing._id, { ...summary, catchUpVerifiedSeasons: retainCatchUpVerifications(existing, summary.seasonWatchedCounts), ...(!repair ? { updatedAt: Date.now() } : {}) });
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
    userId, tvSeriesId, status: "currently_watching", ...summary, createdAt, updatedAt,
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
