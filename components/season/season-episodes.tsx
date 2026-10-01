"use client";

import { useState } from "react";
import { SeasonEpisode } from "@/lib/tmdb/types";
import { EpisodeStatus } from "@/lib/types";
import { StillImage } from "@/components/media/tmdb-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Star,
  Clock,
  Calendar,
  Play,
  CalendarCheck,
  Check,
  Circle,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchedDateDialog } from "@/components/media/watched-date-dialog";
import { ConfirmButton } from "@/components/common/confirm-dialog";

export function SeasonEpisodes({
  episodes,
  statusMap,
  onToggle
}: {
  episodes: SeasonEpisode[];
  statusMap: Map<number, EpisodeStatus>;
  onToggle: (ep: SeasonEpisode, watchedAt?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SeasonEpisode | null>(null);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);
  const orderedEpisodes = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
  const watchedCount = episodes.filter(ep => statusMap.get(ep.id)?.isWatched).length;
  const allWatched = episodes.length > 0 && watchedCount === episodes.length;
  const today = new Date();
  const nextEpisode = orderedEpisodes.find(
    ep =>
      !statusMap.get(ep.id)?.isWatched &&
      ep.air_date &&
      new Date(`${ep.air_date}T00:00:00`) <= today
  );

  const handleWatchClick = (ep: SeasonEpisode, timestamp: number) => {
    setPending(ep);
    setDefaultMs(timestamp);
    setOpen(true);
  };

  const handleConfirm = (ms?: number) => {
    if (!pending) return;
    onToggle(pending, ms);
    setPending(null);
    setOpen(false);
  };

  if (episodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No episodes available for this season yet</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="episodes-heading" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 id="episodes-heading" className="text-xl font-semibold flex items-center gap-2">
            <Play className="size-5 text-primary" aria-hidden="true" />
            Episodes
          </h2>
          <div
            className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            {allWatched && (
              <Badge variant="watched">
                <Check aria-hidden="true" />
                Season complete
              </Badge>
            )}
            <span>
              {watchedCount} of {episodes.length} watched
              {!allWatched && ` · ${episodes.length - watchedCount} remaining`}
            </span>
          </div>
        </div>
        {nextEpisode && (
          <Button asChild variant="link" size="icon" className="size-9 sm:w-auto sm:px-3">
            <a href={`#episode-${nextEpisode.id}`} aria-label="Jump to next episode">
              <span className="hidden sm:inline">Jump to next</span>
              <ArrowDown data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
      <ol className="flex flex-col gap-3">
        {orderedEpisodes.map(ep => {
          const status = statusMap.get(ep.id);
          const watched = status?.isWatched ?? false;
          const watchedDate = status?.watchedDate;
          const isNext = ep.id === nextEpisode?.id;
          return (
            <li
              key={ep.id}
              id={`episode-${ep.id}`}
              tabIndex={-1}
              aria-labelledby={`episode-title-${ep.id}`}
              className={cn(
                "scroll-mt-24 rounded-xl border p-3 md:p-4 flex flex-col gap-3 transition-colors",
                watched
                  ? "bg-muted/30 border-border/40"
                  : isNext
                    ? "bg-primary/5 border-primary/60"
                    : "bg-card border-border/50 hover:border-primary/30"
              )}
            >
              {isNext && watchedCount > 0 && (
                <p className="flex items-center gap-3 text-xs font-medium text-muted-foreground after:h-px after:flex-1 after:bg-primary/20">
                  Continue here
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Thumbnail */}
                <div className="w-full sm:w-36 md:w-44 shrink-0 rounded-lg overflow-hidden relative group">
                  <StillImage src={ep.still_path} alt={ep.name} size="w300" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-bold text-lg">E{ep.episode_number}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          id={`episode-title-${ep.id}`}
                          className="font-semibold leading-tight flex items-start gap-2"
                        >
                          {watched ? (
                            <Check
                              className="size-4 shrink-0 mt-0.5 text-chart-2"
                              aria-hidden="true"
                            />
                          ) : (
                            <Circle
                              className="size-4 shrink-0 mt-0.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            <span
                              className={cn(
                                "tabular-nums",
                                watched ? "text-muted-foreground" : "text-foreground"
                              )}
                            >
                              E{String(ep.episode_number).padStart(2, "0")}
                            </span>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            {ep.name}
                          </span>
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {ep.air_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(ep.air_date).toLocaleDateString()}
                          </div>
                        )}
                        {ep.runtime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ep.runtime}m
                          </div>
                        )}
                        {ep.vote_average != null && ep.vote_average > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-primary fill-primary" />
                            {ep.vote_average.toFixed(1)}
                          </div>
                        )}
                        {watched && (
                          <div className="flex items-center gap-1">
                            <CalendarCheck className="h-3 w-3" />
                            Watched
                            {watchedDate != null &&
                              ` ${new Date(watchedDate).toLocaleDateString()}`}
                          </div>
                        )}
                        {!watched && !isNext && <span>Unwatched</span>}
                      </div>
                    </div>

                    {watched ? (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        title="Unwatch episode?"
                        description="This will remove your watched date."
                        confirmText="Unwatch"
                        onConfirm={() => onToggle(ep)}
                        className="gap-1.5 shrink-0"
                      >
                        <EyeOff data-icon="inline-start" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Unwatch</span>
                        <span className="sr-only"> episode {ep.episode_number}</span>
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        variant={isNext ? "default" : "outline"}
                        onClick={() => handleWatchClick(ep, Date.now())}
                        className="gap-1.5 shrink-0"
                      >
                        <Eye data-icon="inline-start" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Watch</span>
                        <span className="sr-only"> episode {ep.episode_number}</span>
                      </Button>
                    )}
                  </div>

                  {ep.overview && (
                    <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                      {ep.overview}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <WatchedDateDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        defaultValueMs={defaultMs}
      />
    </section>
  );
}
