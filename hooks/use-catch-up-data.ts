import { useConvexAuth, usePaginatedQuery, useQueries as useConvexQueries } from "convex/react";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { tmdbKeys } from "@/lib/tmdb/react-query";
import { buildCatchUpItem, comparisonIds, seasonPlan } from "@/lib/catch-up";
import type { CatchUpItem } from "@/lib/catch-up-types";
import type { TMDBSeason } from "@/lib/tmdb/types";

export function useCatchUpData() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(api.catchUp.list, isAuthenticated ? {} : "skip", { initialNumItems: 25 });
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date().toISOString().slice(0, 10)), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Only public metadata enters the shared React Query cache. Private watched
  // IDs remain in authenticated, reactive Convex subscriptions.
  const seriesQueries = useQueries({ queries: results.map(row => ({
    queryKey: tmdbKeys.tv(row.tvSeriesId),
    queryFn: ({ signal }: { signal: AbortSignal }) => tmdbClient.getTVSeriesDetails(row.tvSeriesId, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })) });
  const candidates = results.flatMap((row, i) => {
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
    return Array.from({ length: Math.ceil(ids.length / 100) }, (_, chunk) => ({
      key: `${row.tvSeriesId}:${season.id}:${chunk}:${attempt}`,
      args: { tvSeriesId: row.tvSeriesId, seasonId: season.id, episodeIds: ids.slice(chunk * 100, (chunk + 1) * 100) },
    }));
  });
  const requests = Object.fromEntries(comparisons.map(({ key, args }) => [key, { query: api.catchUp.watchedIds, args }]));
  const watchedQueries = useConvexQueries(requests);

  const catchUpItems: CatchUpItem[] = [];
  let failedShows = 0;
  for (const [i, row] of results.entries()) {
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
  }
  catchUpItems.sort((a, b) => b.unwatchedEpisodes - a.unwatchedEpisodes || a.name.localeCompare(b.name));
  const isLoading = authLoading || status === "LoadingFirstPage" || status === "LoadingMore" ||
    seriesQueries.some(q => q.isPending || q.isFetching) || seasonQueries.some(q => q.isPending || q.isFetching) ||
    Object.values(watchedQueries).some(value => value === undefined);
  const refreshing = refreshNeeded.some((needed, i) => needed && !seasonQueries[i].isError);
  const isComplete = isAuthenticated && status === "Exhausted" && !isLoading && !refreshing && failedShows === 0;
  const retry = () => {
    setAttempt(value => value + 1);
    for (const q of [...seriesQueries, ...seasonQueries]) if (q.isError) void q.refetch();
  };
  return {
    catchUpItems, isLoading: isLoading || refreshing, isComplete, failedShows, retry,
    canLoadMore: status === "CanLoadMore", loadMore: () => loadMore(25),
    totalUpToDate: results.length,
    totalNeedingAttention: catchUpItems.length,
    totalUnwatchedEpisodes: catchUpItems.reduce((sum, item) => sum + item.unwatchedEpisodes, 0),
    totalUpcoming: catchUpItems.filter(item => item.upcomingSeasons.length > 0).length,
  };
}
