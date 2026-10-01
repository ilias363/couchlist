"use client";

import { useParams } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { SeasonEpisode } from "@/lib/tmdb/types";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { SeasonEpisodes } from "@/components/season/season-episodes";
import { SeasonHeader } from "@/components/season/season-header";
import { CrewAndGuests } from "@/components/season/crew-and-guests";
import { useTMDBSeason, useTMDBTvSeries } from "@/lib/tmdb/react-query";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EpisodeStatus } from "@/lib/types";

export default function SeasonDetailsPage() {
  const { tmdbId, seasonNumber } = useParams<{ tmdbId: string; seasonNumber: string }>();
  const seriesId = Number(tmdbId);
  const seasonNum = Number(seasonNumber);

  const { data: season, isLoading: loading, error } = useTMDBSeason(seriesId, seasonNum);
  const { data: series } = useTMDBTvSeries(seriesId);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const episodeStatuses = useQuery(
    api.tv.getSeasonEpisodesStatus,
    season ? { tvSeriesId: seriesId, seasonId: season.id } : "skip"
  );

  const toggleEpisode = useMutation(api.tv.toggleEpisodeWatched);
  const bulkToggle = useMutation(api.tv.bulkToggleSeasonEpisodes);

  const statusMap = useMemo(() => {
    const m = new Map<number, EpisodeStatus>();
    if (episodeStatuses) {
      for (const r of episodeStatuses) {
        m.set(r.episodeId, { isWatched: r.isWatched, watchedDate: r.watchedDate });
      }
    }
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
    () => episodesInfo.filter(e => statusMap.get(e.episodeId)?.isWatched).length,
    [episodesInfo, statusMap]
  );
  const allWatched = episodesInfo.length > 0 && watchedCount === episodesInfo.length;
  const anyWatched = watchedCount > 0;

  const handleMarkAllWatched = useCallback(
    async (watchedAt?: number) => {
      if (!season) return;
      try {
        setBulkUpdating(true);
        await bulkToggle({
          tvSeriesId: seriesId,
          seasonId: season.id,
          episodesInfo: episodesInfo,
          isWatched: true,
          watchedAt,
        });
      } finally {
        setBulkUpdating(false);
      }
    },
    [season, seriesId, episodesInfo, bulkToggle]
  );

  const handleMarkAllUnwatched = useCallback(async () => {
    if (!season) return;
    try {
      setBulkUpdating(true);
      await bulkToggle({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodesInfo: episodesInfo,
        isWatched: false,
      });
    } finally {
      setBulkUpdating(false);
    }
  }, [season, seriesId, episodesInfo, bulkToggle]);

  const handleToggleEpisode = useCallback(
    async (ep: SeasonEpisode, watchedAt?: number) => {
      if (!season) return;
      await toggleEpisode({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodeId: ep.id,
        runtime: ep.runtime ?? undefined,
        isWatched: !statusMap.get(ep.id)?.isWatched,
        watchedAt,
      });
    },
    [season, seriesId, statusMap, toggleEpisode]
  );

  if (loading || (season && episodeStatuses === undefined)) {
    return <SeasonSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="p-4 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Error loading season</h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button asChild variant="outline">
          <Link href={`/tv-series/${seriesId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Series
          </Link>
        </Button>
      </div>
    );
  }

  if (!season) return null;

  return (
    <div className="space-y-8 -mt-2">
      {/* Season Header */}
      <SeasonHeader
        season={season}
        allWatched={allWatched}
        anyWatched={anyWatched}
        bulkUpdating={bulkUpdating}
        onMarkAllWatched={handleMarkAllWatched}
        onMarkAllUnwatched={handleMarkAllUnwatched}
        seasons={series?.seasons}
        seriesId={seriesId}
        seriesName={series?.name}
      />

      {/* Episodes List */}
      <SeasonEpisodes
        episodes={season.episodes}
        statusMap={statusMap}
        onToggle={handleToggleEpisode}
      />

      {/* Crew and Guests */}
      <CrewAndGuests season={season} />
    </div>
  );
}

function SeasonSkeleton() {
  return (
    <div className="space-y-8 -mt-2">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row gap-6">
        <Skeleton className="w-40 md:w-48 aspect-2/3 rounded-xl mx-auto md:mx-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      {/* Episodes skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 rounded-xl border border-border/50">
              <Skeleton className="w-28 aspect-video rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
