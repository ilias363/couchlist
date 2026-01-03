"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Film } from "lucide-react";
import { PosterImage } from "@/components/tmdb-image";
import { cn } from "@/lib/utils";

interface SeasonCardProps {
  seriesId: number;
  seasonNumber: number;
  name: string;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
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
  overview,
  className,
}: SeasonCardProps) {
  const year = airDate ? new Date(airDate).getFullYear() : null;

  return (
    <Link
      href={`/tv-series/${seriesId}/season/${seasonNumber}`}
      className={cn(
        "group flex gap-2 p-2 rounded-lg border bg-card transition-all hover:shadow-md hover:border-primary/50",
        className
      )}
    >
      {/* Poster */}
      <div className="relative flex-shrink-0 w-20 aspect-[2/3] rounded-md overflow-hidden bg-muted">
        {posterPath ? (
          <PosterImage src={posterPath} alt={name} size="w185" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold group-hover:text-primary transition-colors">{name}</h3>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {year}
            </span>
          )}
          <span>{episodeCount} episodes</span>
        </div>

        {overview && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{overview}</p>}
      </div>
    </Link>
  );
}
