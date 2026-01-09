"use client";

import { useState } from "react";
import { SeasonEpisode } from "@/lib/tmdb/types";
import { EpisodeStatus } from "@/lib/types";
import { StillImage } from "@/components/media/tmdb-image";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Star, Clock, Calendar, Play, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchedDateDialog } from "@/components/media/watched-date-dialog";
import { ConfirmButton } from "@/components/common/confirm-dialog";

export function SeasonEpisodes({
  episodes,
  statusMap,
  onToggle,
}: {
  episodes: SeasonEpisode[];
  statusMap: Map<number, EpisodeStatus>;
  onToggle: (ep: SeasonEpisode, watchedAt?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SeasonEpisode | null>(null);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

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
        <p>No episodes match your filter</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Play className="h-5 w-5 text-primary" />
        Episodes
      </h2>
      <div className="space-y-3">
        {episodes.map(ep => {
          const status = statusMap.get(ep.id);
          const watched = status?.isWatched ?? false;
          const watchedDate = status?.watchedDate;
          return (
            <div
              key={ep.id}
              className={cn(
                "rounded-xl border border-border/50 p-3 md:p-4 flex flex-col sm:flex-row gap-4 transition-all",
                watched
                  ? "bg-muted/30 border-green-500/20"
                  : "bg-card hover:border-primary/30 hover:shadow-md"
              )}
            >
              {/* Thumbnail */}
              <div className="w-full sm:w-36 md:w-44 shrink-0 rounded-lg overflow-hidden relative group">
                <StillImage src={ep.still_path} alt={ep.name} size="w300" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-lg">E{ep.episode_number}</span>
                </div>
                {watched && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500/90 text-white text-xs font-medium rounded-full">
                    Watched
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-semibold leading-tight">
                      <span className="text-primary">E{ep.episode_number}</span>
                      <span className="mx-1.5">·</span>
                      {ep.name}
                    </h3>
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
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          {ep.vote_average.toFixed(1)}
                        </div>
                      )}
                      {watched && watchedDate && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CalendarCheck className="h-3 w-3" />
                          Watched {new Date(watchedDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {watched ? (
                    <ConfirmButton
                      size="sm"
                      variant="outline"
                      title="Unwatch episode?"
                      description="This will remove your watched date."
                      confirmText="Unwatch"
                      onConfirm={() => onToggle(ep)}
                      className={cn("gap-1.5 shrink-0", "text-muted-foreground")}
                    >
                      <EyeOff className="h-4 w-4" />
                      <span className="hidden sm:inline">Unwatch</span>
                    </ConfirmButton>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleWatchClick(ep, Date.now())}
                      className="gap-1.5 shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">Watch</span>
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
          );
        })}
      </div>

      <WatchedDateDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        defaultValueMs={defaultMs}
      />
    </div>
  );
}
