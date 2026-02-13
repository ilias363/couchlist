import { useQuery } from "convex/react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { tmdbKeys } from "@/lib/tmdb/react-query";
import { TMDBTvSeries, TMDBSeason } from "@/lib/tmdb/types";
import { useUserStatuses } from "@/components/providers/user-status-provider";
import { CatchUpItem, CatchUpSeasonInfo } from "@/lib/catch-up-types";

export function useCatchUpData() {
  // Get quick count from already-loaded UserStatusProvider
  const { tvStatuses } = useUserStatuses();
  const quickUpToDateCount = Object.values(tvStatuses).filter(s => s.status === "up_to_date").length;

  // Get all "up to date" series with their watched episode IDs
  const upToDateData = useQuery(api.tv.getUpToDateSeriesWithEpisodes);

  const seriesIds = upToDateData?.map(s => s.tvSeriesId) ?? [];

  // Fetch TMDB details (shared cache with other pages)
  const seriesQueries = useQueries({
    queries: seriesIds.map(id => ({
      queryKey: tmdbKeys.tv(id),
      queryFn: () => tmdbClient.getTVSeriesDetails(id),
      enabled: seriesIds.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const seriesMap = new Map<number, TMDBTvSeries>();
  seriesQueries.forEach((q, i) => {
    if (q.data) seriesMap.set(seriesIds[i], q.data);
  });

  // Only fetch season details for series that might have unwatched content
  const seasonRequests: { seriesId: number; seasonNumber: number }[] = [];
  if (upToDateData) {
    const watchedCounts = new Map(
      upToDateData.map(s => [s.tvSeriesId, s.watchedEpisodeIds.length])
    );
    for (const [seriesId, details] of seriesMap) {
      if (!details?.seasons) continue;
      const watched = watchedCounts.get(seriesId) ?? 0;
      if (watched >= details.number_of_episodes && details.status !== "Returning Series") continue;
      for (const season of details.seasons) {
        if (season.season_number !== 0) {
          seasonRequests.push({ seriesId, seasonNumber: season.season_number });
        }
      }
    }
  }

  // Fetch all seasons in parallel (shared cache)
  const seasonQueries = useQueries({
    queries: seasonRequests.map(({ seriesId, seasonNumber }) => ({
      queryKey: tmdbKeys.season(seriesId, seasonNumber),
      queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
      enabled: seasonRequests.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const seasonDataMap = new Map<number, Map<number, TMDBSeason>>();
  seasonQueries.forEach((q, i) => {
    if (q.data) {
      const req = seasonRequests[i];
      if (!seasonDataMap.has(req.seriesId)) seasonDataMap.set(req.seriesId, new Map());
      seasonDataMap.get(req.seriesId)!.set(req.seasonNumber, q.data);
    }
  });

  // Compute catch-up items
  const computeCatchUpItems = (): CatchUpItem[] => {
    if (!upToDateData) return [];

    const now = new Date();
    const items: CatchUpItem[] = [];

    for (const { tvSeriesId, watchedEpisodeIds } of upToDateData) {
      const details = seriesMap.get(tvSeriesId);
      if (!details) continue;

      const watchedSet = new Set(watchedEpisodeIds);
      const seasonsData = seasonDataMap.get(tvSeriesId);
      if (!seasonsData) continue;

      let totalEpisodes = 0;
      let watchedCount = 0;
      const unwatchedSeasons: CatchUpSeasonInfo[] = [];
      const upcomingSeasons: CatchUpSeasonInfo[] = [];

      for (const [seasonNumber, seasonData] of seasonsData) {
        if (!seasonData.episodes) continue;

        const airedEpisodes = seasonData.episodes.filter(ep => {
          if (!ep.air_date) return false;
          return new Date(ep.air_date) <= now;
        });

        const futureEpisodes = seasonData.episodes.filter(ep => {
          if (!ep.air_date) return false;
          return new Date(ep.air_date) > now;
        });

        const seasonWatchedCount = airedEpisodes.filter(ep =>
          watchedSet.has(ep.id)
        ).length;

        totalEpisodes += airedEpisodes.length;
        watchedCount += seasonWatchedCount;

        const unwatchedInSeason = airedEpisodes.length - seasonWatchedCount;

        const seasonMeta = details.seasons?.find(
          s => s.season_number === seasonNumber
        );
        const isFullyUpcoming =
          airedEpisodes.length === 0 &&
          (seasonData.episodes.length > 0 ||
            (seasonMeta?.air_date && new Date(seasonMeta.air_date) > now));

        if (isFullyUpcoming) {
          upcomingSeasons.push({
            seasonNumber,
            name: seasonMeta?.name ?? `Season ${seasonNumber}`,
            episodeCount: seasonData.episodes.length || seasonMeta?.episode_count || 0,
            watchedCount: 0,
            airDate: seasonMeta?.air_date ?? null,
            isUpcoming: true,
          });
        } else if (unwatchedInSeason > 0 || futureEpisodes.length > 0) {
          unwatchedSeasons.push({
            seasonNumber,
            name: seasonMeta?.name ?? `Season ${seasonNumber}`,
            episodeCount: airedEpisodes.length,
            watchedCount: seasonWatchedCount,
            airDate: seasonMeta?.air_date ?? null,
            isUpcoming: false,
          });
        }
      }

      // Check for upcoming seasons in TMDB list not yet fetched
      if (details.seasons) {
        for (const season of details.seasons) {
          if (season.season_number === 0) continue;
          if (seasonsData.has(season.season_number)) continue;
          if (season.air_date && new Date(season.air_date) > now) {
            upcomingSeasons.push({
              seasonNumber: season.season_number,
              name: season.name,
              episodeCount: season.episode_count,
              watchedCount: 0,
              airDate: season.air_date,
              isUpcoming: true,
            });
          }
        }
      }

      const unwatchedEpisodes = totalEpisodes - watchedCount;

      if (unwatchedEpisodes > 0 || upcomingSeasons.length > 0) {
        items.push({
          tvSeriesId,
          name: details.name,
          posterPath: details.poster_path,
          tmdbStatus: details.status,
          totalEpisodes,
          watchedEpisodes: watchedCount,
          unwatchedEpisodes,
          unwatchedSeasons,
          upcomingSeasons,
        });
      }
    }

    items.sort(
      (a, b) => b.unwatchedEpisodes - a.unwatchedEpisodes || a.name.localeCompare(b.name)
    );

    return items;
  };

  const catchUpItems = computeCatchUpItems();

  const seriesLoading = seriesQueries.some(q => q.isLoading);
  const seasonsLoading = seasonQueries.some(q => q.isLoading);
  const isLoading = upToDateData === undefined || seriesLoading || seasonsLoading;

  return {
    catchUpItems,
    isLoading,
    totalUpToDate: upToDateData?.length ?? quickUpToDateCount,
    totalNeedingAttention: catchUpItems.length,
    totalUnwatchedEpisodes: catchUpItems.reduce(
      (sum, item) => sum + item.unwatchedEpisodes,
      0
    ),
    totalUpcoming: catchUpItems.filter(item => item.upcomingSeasons.length > 0).length,
  };
}
