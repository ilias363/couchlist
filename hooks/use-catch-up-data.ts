import { useConvexAuth, useMutation, usePaginatedQuery, useQueries as useConvexQueries, useQuery } from "convex/react";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { tmdbKeys } from "@/lib/tmdb/react-query";
import { buildCatchUpItem, comparisonIds, isFinishedSeason, seasonPlan } from "@/lib/catch-up";
import type { CatchUpSummary } from "@/lib/catch-up";
import type { CatchUpItem } from "@/lib/catch-up-types";
import type { TMDBSeason } from "@/lib/tmdb/types";
import type { FunctionArgs } from "convex/server";

function proofKey(tvSeriesId: number, seasonId: number, proof: NonNullable<CatchUpSummary["catchUpVerifiedSeasons"]>[string]) {
  return JSON.stringify([tvSeriesId, seasonId, proof.episodeCount, proof.airDate, proof.watchedCount]);
}

export function useCatchUpData() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(api.catchUp.list, isAuthenticated ? {} : "skip", { initialNumItems: 25 });
  const ready = useQuery(api.catchUp.isReady, isAuthenticated ? {} : "skip");
  const isUpdating = ready === false || results.some(row => !row.summariesReady);
  const summaries = ready && !isUpdating ? results : [];
  const verifySeasons = useMutation(api.catchUp.verifySeasons);
  const revokeVerifications = useMutation(api.catchUp.revokeVerifications);
  const submitted = useRef(new Set<string>());
  const [revokedProofs, setRevokedProofs] = useState<Set<string>>(() => new Set());
  const [retries, setRetries] = useState<Record<string, number>>({});
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date().toISOString().slice(0, 10)), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Only public metadata enters the shared React Query cache. Private watched
  // IDs remain in authenticated, reactive Convex subscriptions.
  const seriesQueries = useQueries({ queries: summaries.map(row => ({
    queryKey: tmdbKeys.tv(row.tvSeriesId),
    queryFn: ({ signal }: { signal: AbortSignal }) => tmdbClient.getTVSeriesDetails(row.tvSeriesId, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })) });
  const revocations: FunctionArgs<typeof api.catchUp.revokeVerifications>[] = summaries.flatMap((row, i) => {
    const details = seriesQueries[i].data;
    if (!details) return [];
    const seasons = Object.entries(row.catchUpVerifiedSeasons ?? {}).flatMap(([id, proof]) => {
      const season = details.seasons.find(s => s.id === Number(id));
      const count = row.seasonWatchedCounts ? row.seasonWatchedCounts[id] ?? 0 : null;
      return !season || season.episode_count !== proof.episodeCount || season.air_date !== proof.airDate || count !== proof.watchedCount
        ? [{ seasonId: Number(id), ...proof }] : [];
    });
    return seasons.length ? [{ tvSeriesId: row.tvSeriesId, seasons }] : [];
  });
  // Remember contradicted evidence immediately, even if its old count returns
  // before the revocation reaches Convex. The existing cache still owns TMDB data.
  const rejected = new Set(revokedProofs);
  for (const row of revocations) for (const proof of row.seasons) rejected.add(proofKey(row.tvSeriesId, proof.seasonId, proof));
  const rows = summaries.map(row => ({ ...row, catchUpVerifiedSeasons: Object.fromEntries(
    Object.entries(row.catchUpVerifiedSeasons ?? {}).filter(([id, proof]) => !rejected.has(proofKey(row.tvSeriesId, Number(id), proof))),
  ) }));
  const revocationPayload = JSON.stringify(revocations);
  useEffect(() => {
    const work: FunctionArgs<typeof api.catchUp.revokeVerifications>[] = JSON.parse(revocationPayload);
    setRevokedProofs(previous => {
      const keys = work.flatMap(row => row.seasons.map(proof => proofKey(row.tvSeriesId, proof.seasonId, proof)));
      return keys.some(key => !previous.has(key)) ? new Set([...previous, ...keys]) : previous;
    });
    let cancelled = false;
    void (async () => {
      for (const revocation of work) {
        if (cancelled) break;
        const key = `revoke:${attempt}:${JSON.stringify(revocation)}`;
        if (submitted.current.has(key)) continue;
        submitted.current.add(key);
        try { await revokeVerifications(revocation); } catch { /* Keep rejecting locally; a later visit/retry can revoke again. */ }
      }
    })();
    return () => { cancelled = true; };
  }, [revocationPayload, revokeVerifications, attempt]);
  const candidates = rows.flatMap((row, i) => {
    const details = seriesQueries[i].data;
    return details ? seasonPlan(details, row, today).flatMap(plan =>
      plan.kind === "candidate" ? [{ row, season: plan.season, seriesUpdatedAt: seriesQueries[i].dataUpdatedAt }] : []) : [];
  });
  const seasonQueries = useQueries({ queries: candidates.map(({ row, season }) => ({
    queryKey: tmdbKeys.season(row.tvSeriesId, season.season_number),
    queryFn: ({ signal }: { signal: AbortSignal }) => tmdbClient.getSeasonDetails(row.tvSeriesId, season.season_number, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })) });
  // A fresh series response can revise a count while a season's shared cache
  // is still fresh. Refresh that entry once, without inventing another key or
  // cache. If TMDB itself remains inconsistent, show the missing dates below.
  const refreshNeeded = candidates.map((candidate, i) => {
    const q = seasonQueries[i];
    return !!q.data && q.data.episodes.length !== candidate.season.episode_count && q.dataUpdatedAt < candidate.seriesUpdatedAt;
  });
  useEffect(() => {
    seasonQueries.forEach((q, i) => {
      if (refreshNeeded[i] && q.fetchStatus === "idle" && !q.isError) void q.refetch();
    });
  }, [seasonQueries, refreshNeeded]);
  const comparisons = candidates.flatMap(({ row, season }, i) => {
    const details = seasonQueries[i].data;
    if (!details || refreshNeeded[i] || (row.seasonWatchedCounts && !row.seasonWatchedCounts[String(season.id)])) return [];
    const ids = comparisonIds(details, today);
    return Array.from({ length: Math.ceil(ids.length / 100) }, (_, chunk) => {
      const key = `${row.tvSeriesId}:${season.id}:${chunk}`;
      return { key, args: { tvSeriesId: row.tvSeriesId, seasonId: season.id, episodeIds: ids.slice(chunk * 100, (chunk + 1) * 100), retry: retries[key] ?? 0 } };
    });
  });
  // Convex's subscription hook updates during render when its input identity
  // changes. Keep even the empty object stable until IDs or retry args change.
  const requestPayload = JSON.stringify(comparisons);
  const requests = useMemo(() => {
    const values: typeof comparisons = JSON.parse(requestPayload);
    return Object.fromEntries(values.map(({ key, args }) => [key, { query: api.catchUp.watchedIds, args }]));
  }, [requestPayload]);
  const watchedQueries = useConvexQueries(requests);

  const catchUpItems: CatchUpItem[] = [];
  const verifications: FunctionArgs<typeof api.catchUp.verifySeasons>[] = [];
  let failedShows = 0;
  for (const [i, row] of rows.entries()) {
    const details = seriesQueries[i].data;
    const seasons = new Map<number, TMDBSeason>();
    const watched = new Map<number, Set<number>>();
    let failed = seriesQueries[i].isError;
    for (const [j, candidate] of candidates.entries()) {
      if (candidate.row.tvSeriesId !== row.tvSeriesId) continue;
      const data = seasonQueries[j].data;
      failed ||= seasonQueries[j].isError;
      if (!data || refreshNeeded[j]) continue;
      seasons.set(candidate.season.season_number, data);
      const chunks = comparisons.filter(c => c.args.tvSeriesId === row.tvSeriesId && c.args.seasonId === candidate.season.id);
      const values = chunks.map(c => watchedQueries[c.key] as number[] | Error | undefined);
      failed ||= values.some(value => value instanceof Error);
      if (values.every((value): value is number[] => Array.isArray(value))) {
        watched.set(candidate.season.id, new Set(values.flat()));
      }
    }
    if (failed) { failedShows++; continue; }
    if (!details) continue;
    const item = buildCatchUpItem(details, row, today, seasons, watched);
    if (item) catchUpItems.push(item);
    if (item === undefined) continue;
    let batch: FunctionArgs<typeof api.catchUp.verifySeasons>["seasons"] = [];
    let batchSize = 0;
    const proofEligibleIds = new Set(details.seasons.filter(s => s.season_number !== 0).slice(0, 100).map(s => s.id));
    for (const { season, kind } of seasonPlan(details, row, today)) {
      const inventory = seasons.get(season.season_number);
      const ids = watched.get(season.id);
      if (kind !== "candidate" || !proofEligibleIds.has(season.id) || !inventory || !ids || !isFinishedSeason(details, season, today) ||
        !inventory.episodes.length || inventory.episodes.length > 100 || inventory.episodes.length !== season.episode_count ||
        !inventory.episodes.every(ep => ep.air_date && ep.air_date <= today && ids.has(ep.id))) continue;
      if (batchSize + inventory.episodes.length > 100) {
        verifications.push({ tvSeriesId: row.tvSeriesId, seasons: batch }); batch = []; batchSize = 0;
      }
      batch.push({ seasonId: season.id, airDate: season.air_date, episodeIds: inventory.episodes.map(ep => ep.id) });
      batchSize += inventory.episodes.length;
    }
    if (batch.length) verifications.push({ tvSeriesId: row.tvSeriesId, seasons: batch });
  }
  // Keep the persistence queue stable across unrelated observer renders.
  const verificationPayload = JSON.stringify(verifications);
  useEffect(() => {
    // Persist only compact completeness evidence; the existing TMDB cache owns
    // inventories. Recheck IDs atomically on the server before saving proof.
    let cancelled = false;
    void (async () => {
      const work: FunctionArgs<typeof api.catchUp.verifySeasons>[] = JSON.parse(verificationPayload);
      for (const verification of work) {
        if (cancelled) break;
        const key = `${attempt}:${JSON.stringify(verification)}`;
        if (submitted.current.has(key)) continue;
        submitted.current.add(key);
        try { await verifySeasons(verification); } catch { /* A later visit/retry can verify again. */ }
      }
    })();
    return () => { cancelled = true; };
  }, [verificationPayload, verifySeasons, attempt]);
  catchUpItems.sort((a, b) => b.unwatchedEpisodes - a.unwatchedEpisodes || a.name.localeCompare(b.name));
  const isLoading = authLoading || ready === undefined || isUpdating || status === "LoadingFirstPage" || status === "LoadingMore" ||
    seriesQueries.some(q => q.isPending || q.isFetching) || seasonQueries.some(q => q.isPending || q.isFetching) ||
    Object.values(watchedQueries).some(value => value === undefined);
  const refreshing = refreshNeeded.some((needed, i) => needed && !seasonQueries[i].isError);
  const isComplete = isAuthenticated && status === "Exhausted" && !isLoading && !refreshing && failedShows === 0;
  const retry = () => {
    setRetries(previous => {
      const next = { ...previous };
      for (const { key } of comparisons) if (watchedQueries[key] instanceof Error) next[key] = (next[key] ?? 0) + 1;
      return next;
    });
    setAttempt(value => value + 1);
    for (const q of [...seriesQueries, ...seasonQueries]) if (q.isError) void q.refetch();
  };
  return {
    catchUpItems, isLoading: isLoading || refreshing, isComplete, isUpdating, failedShows, retry,
    canLoadMore: status === "CanLoadMore", loadMore: () => loadMore(25),
    totalUpToDate: results.length,
    totalNeedingAttention: catchUpItems.length,
    totalUnwatchedEpisodes: catchUpItems.reduce((sum, item) => sum + item.unwatchedEpisodes, 0),
    totalUpcoming: catchUpItems.filter(item => item.upcomingSeasons.length > 0).length,
  };
}
