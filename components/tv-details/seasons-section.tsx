"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SeasonEpisodes } from "@/components/season/season-episodes";
import { SeasonHeader } from "@/components/season/season-header";
import { CrewAndGuests } from "@/components/season/crew-and-guests";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const seasonsNav = useRef<HTMLElement>(null);
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

  useEffect(() => {
    const nav = seasonsNav.current;
    const selectedLink = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selectedLink) return;
    const selectedBounds = selectedLink.getBoundingClientRect();
    // Reveal the selected season horizontally without moving the page past the series hero.
    nav.scrollLeft += selectedBounds.left - nav.getBoundingClientRect().left - (nav.clientWidth - selectedBounds.width) / 2;
  }, [selectedSeason?.season_number]);

  if (!selectedSeason) return null;

  return (
    <section id="episodes" aria-labelledby="seasons-heading" className={cn("flex scroll-mt-24 flex-col gap-6", className)}>
      <h2 id="seasons-heading" className="sr-only">Seasons &amp; episodes</h2>
      <nav ref={seasonsNav} aria-label="Seasons" className="flex overflow-x-auto border-b border-border/60 scrollbar-thin">
        {selectableSeasons.map(season => {
          const watched = seasonWatchedCounts?.[String(season.id)] ?? 0;
          const selected = season.season_number === selectedSeason.season_number;
          const params = new URLSearchParams(searchParams.toString());
          params.set("season", String(season.season_number));
          return (
            <a
              key={season.id}
              href={`/tv-series/${seriesId}?${params}#episodes`}
              aria-current={selected ? "page" : undefined}
              aria-label={watched > 0
                ? `${season.name}, ${watched} of ${season.episode_count} episodes watched`
                : `${season.name}, ${season.episode_count} episodes`}
              onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (!selected) window.history.pushState(null, "", event.currentTarget.href);
              }}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:text-base",
                selected ? "border-primary text-primary" : "border-transparent text-foreground/80"
              )}
            >
              {season.name}
              <span className="tabular-nums opacity-70">({watched > 0 ? `${watched}/${season.episode_count}` : season.episode_count})</span>
            </a>
          );
        })}
      </nav>
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
