"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { SeasonEpisode, TMDBSeason } from "@/lib/tmdb/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Users, Stars } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonEpisodes } from "@/components/season/season-episodes";
import { SeasonHeader } from "@/components/season/season-header";
import { Progress } from "@/components/ui/progress";
import { EpisodeFilters } from "@/components/season/episode-filters";
import { ProgressSummary } from "@/components/season/progress-summary";
import { ProfileImage } from "@/components/tmdb-image";
import { CrewAndGuests } from "@/components/season/crew-and-guests";

export default function SeasonDetailsPage() {
  const { tmdbId, seasonNumber } = useParams<{ tmdbId: string; seasonNumber: string }>();
  const seriesId = Number(tmdbId);
  const seasonNum = Number(seasonNumber);

  const [season, setSeason] = useState<TMDBSeason | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [filter, setFilter] = useState<"all" | "watched" | "unwatched">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!seriesId || !seasonNum) return;
      setLoading(true);
      setError(null);
      try {
        const s = await tmdbClient.getSeasonDetails(seriesId, seasonNum);
        if (!cancelled) setSeason(s);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load season");
      } finally {
        !cancelled && setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [seriesId, seasonNum]);

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

  const allEpisodeIds = useMemo(() => season?.episodes.map(e => e.id) || [], [season]);
  const watchedCount = useMemo(
    () => allEpisodeIds.filter(id => statusMap.get(id)).length,
    [allEpisodeIds, statusMap]
  );
  const allWatched = allEpisodeIds.length > 0 && watchedCount === allEpisodeIds.length;

  const handleBulkToggle = useCallback(async () => {
    if (!season) return;
    try {
      setBulkUpdating(true);
      await bulkToggle({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodeIds: allEpisodeIds,
        isWatched: !allWatched,
      });
    } finally {
      setBulkUpdating(false);
    }
  }, [season, seriesId, allEpisodeIds, allWatched, bulkToggle]);

  const handleToggleEpisode = useCallback(
    async (ep: SeasonEpisode) => {
      if (!season) return;
      await toggleEpisode({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodeId: ep.id,
        isWatched: !statusMap.get(ep.id),
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
          <ProgressSummary watched={watchedCount} total={allEpisodeIds.length} />
          <Progress
            value={allEpisodeIds.length ? (watchedCount / allEpisodeIds.length) * 100 : 0}
          />
        </div>
      )}
      {loading && <SeasonSkeleton />}
      {error && !loading && <div className="text-sm text-destructive">{error}</div>}
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
