"use client";

import { TMDBSeason } from "@/lib/tmdb/types";
import { PosterImage } from "@/components/tmdb-image";
import { Button } from "@/components/ui/button";
import { ReactNode, useState } from "react";
import { WatchedDateDialog } from "@/components/watched-date-dialog";

export function SeasonHeader({
  season,
  allWatched,
  bulkUpdating,
  onBulkToggle,
  extra,
}: {
  season: TMDBSeason;
  allWatched: boolean;
  bulkUpdating: boolean;
  onBulkToggle: (watchedAt?: number) => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

  const handleBulkClick = () => {
    if (!allWatched) {
      setDefaultMs(Date.now());
      setOpen(true);
    } else {
      onBulkToggle();
    }
  };

  const handleConfirm = (ms: number) => {
    onBulkToggle(ms);
    setOpen(false);
  };
  return (
    <div className="flex flex-col items-center justify-center md:flex-row gap-6">
      <div className="w-32 sm:w-40 md:w-48 rounded-md border overflow-hidden">
        <PosterImage src={season.poster_path} alt={season.name} size="w342" />
      </div>
      <div className="flex-1 space-y-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{season.name}</h1>
          <p className="text-xs text-muted-foreground">
            Season {season.season_number} • {season.episodes.length} episodes
          </p>
          {season.air_date && (
            <p className="text-xs text-muted-foreground">
              Air Date: {new Date(season.air_date).toLocaleDateString()}
            </p>
          )}
        </div>
        {season.overview && (
          <p className="text-sm max-w-prose leading-relaxed">{season.overview}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant={allWatched ? "outline" : "default"}
            disabled={bulkUpdating || season.episodes.length === 0}
            onClick={handleBulkClick}
          >
            {bulkUpdating ? "Updating..." : allWatched ? "Mark All Unwatched" : "Mark All Watched"}
          </Button>
          {extra}
        </div>
      </div>

      <WatchedDateDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        defaultValueMs={defaultMs}
        title="Watched date for all episodes"
      />
    </div>
  );
}
