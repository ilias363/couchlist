"use client";

import { useParams } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { SeasonEpisode } from "@/lib/tmdb/types";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { SeasonEpisodes } from "@/components/season/season-episodes";
import { SeasonHeader } from "@/components/season/season-header";
import { Progress } from "@/components/ui/progress";
import { EpisodeFilters } from "@/components/season/episode-filters";
import { ProgressSummary } from "@/components/season/progress-summary";
import { CrewAndGuests } from "@/components/season/crew-and-guests";
import { useTMDBSeason } from "@/lib/tmdb/react-query";

export default function SeasonDetailsPage() {
  const { tmdbId, seasonNumber } = useParams<{ tmdbId: string; seasonNumber: string }>();
  const seriesId = Number(tmdbId);
  const seasonNum = Number(seasonNumber);

  const { data: season, isLoading: loading, error } = useTMDBSeason(seriesId, seasonNum);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [filter, setFilter] = useState<"all" | "watched" | "unwatched">("all");

  const episodeStatuses = useQuery(
    api.tv.getSeasonEpisodesStatus,
    season ? { tvSeriesId: seriesId, seasonId: season.id } : "skip"
  );

  const toggleEpisode = useMutation(api.tv.toggleEpisodeWatched);
  const bulkToggle = useMutation(api.tv.bulkToggleSeasonEpisodes);

  const statusMap = useMemo(() => {
    const m = new Map<number, boolean>();
    if (episodeStatuses) for (const r of episodeStatuses) m.set(r.episodeId, r.isWatched);
    return m;
  }, [episodeStatuses]);

  const episodesInfo = useMemo(
    () =>
      season?.episodes.map(e => {
        return { episodeId: e.id, runtime: e.runtime ?? undefined };
      }) || [],
    [season]
  );
  const watchedCount = useMemo(
    () => episodesInfo.filter(e => statusMap.get(e.episodeId)).length,
    [episodesInfo, statusMap]
  );
  const allWatched = episodesInfo.length > 0 && watchedCount === episodesInfo.length;

  const handleBulkToggle = useCallback(
    async (watchedAt?: number) => {
      if (!season) return;
      try {
        setBulkUpdating(true);
        await bulkToggle({
          tvSeriesId: seriesId,
          seasonId: season.id,
          episodesInfo: episodesInfo,
          isWatched: !allWatched,
          watchedAt,
        });
      } finally {
        setBulkUpdating(false);
      }
    },
    [season, seriesId, episodesInfo, allWatched, bulkToggle]
  );

  const handleToggleEpisode = useCallback(
    async (ep: SeasonEpisode, watchedAt?: number) => {
      if (!season) return;
      await toggleEpisode({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodeId: ep.id,
        runtime: ep.runtime ?? undefined,
        isWatched: !statusMap.get(ep.id),
        watchedAt,
      });
    },
    [season, seriesId, statusMap, toggleEpisode]
  );

  const filteredEpisodes = useMemo(() => {
    if (!season) return [];
    if (filter === "all") return season.episodes;
    return season.episodes.filter(ep =>
      filter === "watched" ? statusMap.get(ep.id) : !statusMap.get(ep.id)
    );
  }, [season, filter, statusMap]);

  return (
    <div className="mx-auto">
      {season && (
        <div className="flex items-center gap-2 mt-2 mb-4">
          <ProgressSummary watched={watchedCount} total={episodesInfo.length} />
          <Progress value={episodesInfo.length ? (watchedCount / episodesInfo.length) * 100 : 0} />
        </div>
      )}
      {loading && <SeasonSkeleton />}
      {error && !loading && <div className="text-sm text-destructive">{error.message}</div>}
      {!loading && season && (
        <div className="space-y-12">
          <SeasonHeader
            season={season}
            allWatched={allWatched}
            bulkUpdating={bulkUpdating}
            onBulkToggle={handleBulkToggle}
            extra={null}
          />

          <EpisodeFilters filter={filter} setFilter={setFilter} />

          <SeasonEpisodes
            episodes={filteredEpisodes}
            statusMap={statusMap}
            onToggle={handleToggleEpisode}
          />

          <CrewAndGuests season={season} />
        </div>
      )}
    </div>
  );
}

function SeasonSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <Skeleton className="w-32 h-48 rounded" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-24 aspect-video rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
