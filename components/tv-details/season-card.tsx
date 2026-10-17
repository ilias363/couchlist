"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Check, Film } from "lucide-react";
import { PosterImage } from "@/components/media/tmdb-image";
import { STATUS_COLORS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

interface SeasonCardProps {
  seriesId: number;
  seasonNumber: number;
  name: string;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
  watchedCount?: number;
  overview?: string;
  className?: string;
}

export function SeasonCard({
  seriesId,
  seasonNumber,
  name,
  posterPath,
  airDate,
  episodeCount,
  watchedCount,
  overview,
  className,
}: SeasonCardProps) {
  const year = airDate ? new Date(airDate).getFullYear() : null;
  const allWatched = episodeCount > 0 && watchedCount === episodeCount;
  const hasProgress = episodeCount > 0 && watchedCount !== undefined && watchedCount > 0;

  return (
    <Link
      href={`/tv-series/${seriesId}/season/${seasonNumber}`}
      className={cn(
        "group flex gap-3 p-2.5 rounded-xl border border-border/50 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/40",
        className
      )}
    >
      {/* Poster */}
      <div className="relative shrink-0 w-20 aspect-2/3 rounded-lg overflow-hidden bg-muted">
        {posterPath ? (
          <PosterImage src={posterPath} alt={name} size="w185" sizesAttr="80px" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold group-hover:text-primary transition-colors">{name}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {year}
            </span>
          )}
          <span
            className={cn("inline-flex items-center gap-1 tabular-nums", allWatched && STATUS_COLORS.watched.text)}
            aria-label={hasProgress
              ? allWatched
                ? `All ${episodeCount} episodes watched`
                : `${watchedCount} of ${episodeCount} episodes watched`
              : undefined}
          >
            {allWatched && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
            {hasProgress ? <>{watchedCount}/{episodeCount} watched</> : <>{episodeCount} episodes</>}
          </span>
        </div>

        {overview && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{overview}</p>}
      </div>
    </Link>
  );
}
