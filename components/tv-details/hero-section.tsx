"use client";

import * as React from "react";
import { type WatchStatus, type Genre } from "@/lib/tmdb/types";
import { Badge } from "@/components/ui/badge";
import { StatusSelector } from "@/components/status-selector";
import { BackdropImage, PosterImage } from "@/components/tmdb-image";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TvHeroSectionProps {
  name: string;
  tagline?: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: Genre[];
  firstAirDate: string;
  originalLanguage: string;
  currentStatus?: WatchStatus | null;
  onStatusChange: (status: string, watchedAt?: number) => void;
  onRemove: () => Promise<void>;
  isUpdating?: boolean;
  markEntireSeries: boolean;
  onMarkEntireSeriesChange: (checked: boolean) => void;
  hasSeasons?: boolean;
  className?: string;
}

export function TvHeroSection({
  name,
  tagline,
  overview,
  posterPath,
  backdropPath,
  genres,
  firstAirDate,
  originalLanguage,
  currentStatus,
  onStatusChange,
  onRemove,
  isUpdating = false,
  markEntireSeries,
  onMarkEntireSeriesChange,
  hasSeasons = true,
  className,
}: TvHeroSectionProps) {
  const year = firstAirDate?.split("-")[0];
  const formattedDate = firstAirDate
    ? new Date(firstAirDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section className={cn("relative", className)}>
      {/* Backdrop */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <BackdropImage
          src={backdropPath}
          alt={name}
          size="w1280"
          gradient="bottom"
          priority
          className="min-h-[300px]"
        />
      </div>

      <div className="container px-4 pt-24 pb-8 sm:pt-64">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            <div className="w-48 sm:w-64 rounded-xl overflow-hidden shadow-2xl">
              <PosterImage src={posterPath} alt={name} size="w500" fallbackType="tv" priority />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold sm:text-4xl">
              {name} {year && <span className="text-muted-foreground font-normal">({year})</span>}
            </h1>

            {tagline && <p className="mt-2 text-lg italic text-muted-foreground">{tagline}</p>}

            {/* Genres */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {genres.map(genre => (
                <Badge key={genre.id} variant="secondary">
                  {genre.name}
                </Badge>
              ))}
            </div>

            {/* Meta */}
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
              {formattedDate && <span>{formattedDate}</span>}
              {originalLanguage && <span className="uppercase">{originalLanguage}</span>}
            </div>

            {/* Overview */}
            <p className="mt-6 text-base leading-relaxed max-w-2xl mx-auto sm:mx-0">
              {overview || "No overview available."}
            </p>

            {/* Status Selector */}
            <div className="mt-6 flex justify-center sm:justify-start">
              <StatusSelector
                type="tv"
                currentStatus={currentStatus ?? undefined}
                onChange={onStatusChange}
                onRemove={onRemove}
                disabled={isUpdating}
              >
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={markEntireSeries}
                    onCheckedChange={v => onMarkEntireSeriesChange(Boolean(v))}
                    disabled={isUpdating || !hasSeasons}
                  />
                  <span>Also mark all episodes in this series as watched</span>
                </label>
              </StatusSelector>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
