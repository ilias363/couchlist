"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SeasonCard } from "@/components/tv-details/season-card";
import type { BaseTMDBSeason } from "@/lib/tmdb/types";

interface SeasonsSectionProps {
  seriesId: number;
  seasons: BaseTMDBSeason[];
  className?: string;
}

export function SeasonsSection({ seriesId, seasons, className }: SeasonsSectionProps) {
  // Filter out specials (season 0) and sort by season number
  const regularSeasons = seasons
    .filter(s => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  if (regularSeasons.length === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-xl font-semibold">Seasons</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regularSeasons.map(season => (
          <SeasonCard
            key={season.id}
            seriesId={seriesId}
            seasonNumber={season.season_number}
            name={season.name}
            posterPath={season.poster_path}
            airDate={season.air_date}
            episodeCount={season.episode_count}
            overview={season.overview}
          />
        ))}
      </div>
    </section>
  );
}
