"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, Film } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SeasonEpisodes } from "@/components/season/season-episodes";
import { SeasonHeader } from "@/components/season/season-header";
import { CrewAndGuests } from "@/components/season/crew-and-guests";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTMDBSeason } from "@/lib/tmdb/react-query";
import type { BaseTMDBSeason, SeasonEpisode } from "@/lib/tmdb/types";
import type { EpisodeStatus } from "@/lib/types";
import { bulkToggleSeasonInBatches } from "@/lib/tv-watch-batches";
import { cn } from "@/lib/utils";

interface SeasonsSectionProps {
  seriesId: number;
  seasons: BaseTMDBSeason[];
  seasonWatchedCounts?: Record<string, number>;
  className?: string;
}

export function SeasonsSection({ seriesId, seasons, seasonWatchedCounts, className }: SeasonsSectionProps) {
  const searchParams = useSearchParams();
  const regularSeasons = seasons.filter(s => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const selectableSeasons = [...regularSeasons, ...seasons.filter(s => s.season_number === 0)];
  // The parent waits for progress before mounting. Keep this choice stable as episodes are watched.
  const [initialSeasonNumber] = useState(() => {
    const airedSeasons = regularSeasons.filter(s => s.episode_count > 0 && s.air_date &&
      new Date(`${s.air_date}T00:00:00`) <= new Date());
    const unfinished = airedSeasons.find(s => (seasonWatchedCounts?.[String(s.id)] ?? 0) < s.episode_count);
    return (unfinished ?? airedSeasons.at(-1) ?? selectableSeasons[0])?.season_number;
  });
  const requestedSeason = searchParams.get("season");
  const selectedSeason = selectableSeasons.find(s => requestedSeason !== null && /^\d+$/.test(requestedSeason) &&
    s.season_number === Number(requestedSeason)) ??
    selectableSeasons.find(s => s.season_number === initialSeasonNumber) ?? selectableSeasons[0];

  useEffect(() => {
    if (window.location.hash === "#episodes") {
      document.getElementById("episodes")?.scrollIntoView({ block: "start" });
    }
  }, []);

  if (!selectedSeason) return null;

  const selectSeason = (value: string) => {
    if (value === String(selectedSeason.season_number)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("season", value);
    url.hash = "episodes";
    window.history.pushState(null, "", url);
  };

  return (
    <section id="episodes" aria-labelledby="seasons-heading" className={cn("flex scroll-mt-24 flex-col gap-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="seasons-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Film className="size-5 text-primary" aria-hidden="true" />
          Seasons &amp; episodes
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label={`Select season, current: ${selectedSeason.name}`}>
              {selectedSeason.name}
              <ChevronDown data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuRadioGroup value={String(selectedSeason.season_number)} onValueChange={selectSeason}>
              {selectableSeasons.map(season => {
                const watched = seasonWatchedCounts?.[String(season.id)] ?? 0;
                return (
                  <DropdownMenuRadioItem key={season.id} value={String(season.season_number)}>
                    <span className="flex flex-col gap-0.5">
                      <span>{season.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {seasonWatchedCounts !== undefined && watched > 0
                          ? `${watched}/${season.episode_count} watched`
                          : `${season.episode_count} episodes`}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SelectedSeason key={selectedSeason.season_number} seriesId={seriesId} seasonNumber={selectedSeason.season_number} />
    </section>
  );
}

function SelectedSeason({ seriesId, seasonNumber }: { seriesId: number; seasonNumber: number }) {
  const { data: season, isLoading, error, refetch } = useTMDBSeason(seriesId, seasonNumber);
  const episodeStatuses = useQuery(api.tv.getSeasonEpisodesStatus,
    season ? { tvSeriesId: seriesId, seasonId: season.id } : "skip");
  const toggleEpisode = useMutation(api.tv.toggleEpisodeWatched);
  const bulkToggle = useMutation(api.tv.bulkToggleSeasonEpisodes);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const statusMap = useMemo(() => new Map<number, EpisodeStatus>(
    episodeStatuses?.map(status => [status.episodeId, { isWatched: status.isWatched, watchedDate: status.watchedDate }])
  ), [episodeStatuses]);

  const markSeason = async (isWatched: boolean) => {
    if (!season || updating) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await bulkToggleSeasonInBatches(bulkToggle, {
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodesInfo: season.episodes.map(ep => ({ episodeId: ep.id, runtime: ep.runtime ?? undefined })),
        isWatched,
      });
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Could not update this season. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleEpisode = async (ep: SeasonEpisode, watchedAt?: number) => {
    if (!season || updating) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await toggleEpisode({
        tvSeriesId: seriesId,
        seasonId: season.id,
        episodeId: ep.id,
        runtime: ep.runtime ?? undefined,
        isWatched: !statusMap.get(ep.id)?.isWatched,
        watchedAt,
      });
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Could not update this episode. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (error && !season) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load this season. {error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>Retry season</Button>
      </div>
    );
  }

  if (isLoading || (season && episodeStatuses === undefined)) return <SeasonEpisodesSkeleton />;
  if (!season) return null;

  const watchedCount = season.episodes.filter(ep => statusMap.get(ep.id)?.isWatched).length;
  return (
    <div className="flex flex-col gap-6">
      <SeasonHeader
        season={season}
        allWatched={season.episodes.length > 0 && watchedCount === season.episodes.length}
        anyWatched={watchedCount > 0}
        bulkUpdating={updating}
        onMarkAllWatched={() => markSeason(true)}
        onMarkAllUnwatched={() => markSeason(false)}
      />
      {updateError && <p role="alert" className="text-sm text-destructive">{updateError}</p>}
      <SeasonEpisodes episodes={season.episodes} statusMap={statusMap} onToggle={handleToggleEpisode} disabled={updating} />
      <CrewAndGuests season={season} />
    </div>
  );
}

function SeasonEpisodesSkeleton() {
  return (
    <div role="status" aria-label="Loading season episodes" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16 w-full" />
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
    </div>
  );
}

export function SeasonsSectionSkeleton() {
  return (
    <div id="episodes" className="flex scroll-mt-24 flex-col gap-6">
      <Skeleton className="h-9 w-64" />
      <SeasonEpisodesSkeleton />
    </div>
  );
}
