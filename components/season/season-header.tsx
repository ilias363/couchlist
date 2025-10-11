"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TMDBSeason, BaseTMDBSeason } from "@/lib/tmdb/types";
import { PosterImage } from "@/components/tmdb-image";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { WatchedDateDialog } from "@/components/watched-date-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SeasonHeader({
  season,
  allWatched,
  anyWatched,
  bulkUpdating,
  onMarkAllWatched,
  onMarkAllUnwatched,
  seasons,
  seriesId,
}: {
  season: TMDBSeason;
  allWatched: boolean;
  anyWatched: boolean;
  bulkUpdating: boolean;
  onMarkAllWatched: (watchedAt?: number) => void;
  onMarkAllUnwatched: () => void;
  seasons?: BaseTMDBSeason[];
  seriesId: number;
}) {
  const [open, setOpen] = useState(false);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

  const handleMarkAllWatchedClick = () => {
    setDefaultMs(Date.now());
    setOpen(true);
  };

  const handleConfirm = (ms?: number) => {
    onMarkAllWatched(ms);
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Season {season.season_number} • {season.episodes.length} episodes
            </span>
            <SeasonSwitcher
              seriesId={seriesId}
              seasons={seasons}
              currentSeason={season.season_number}
            />
          </div>
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
          {bulkUpdating ? (
            <Button size="sm" disabled>
              Updating...
            </Button>
          ) : (
            <>
              {!anyWatched && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={season.episodes.length === 0}
                  onClick={handleMarkAllWatchedClick}
                >
                  Mark All Watched
                </Button>
              )}

              {allWatched && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={season.episodes.length === 0}
                  onClick={onMarkAllUnwatched}
                >
                  Mark All Unwatched
                </Button>
              )}

              {anyWatched && !allWatched && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={season.episodes.length === 0}
                    onClick={handleMarkAllWatchedClick}
                  >
                    Mark All Watched
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={season.episodes.length === 0}
                    onClick={onMarkAllUnwatched}
                  >
                    Mark All Unwatched
                  </Button>
                </>
              )}
            </>
          )}
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

function SeasonSwitcher({
  seriesId,
  seasons,
  currentSeason,
}: {
  seriesId: number;
  seasons?: BaseTMDBSeason[];
  currentSeason: number;
}) {
  if (!seasons || seasons.length <= 1) return null;

  const sorted = [...seasons].sort((a, b) => a.season_number - b.season_number);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
          Other seasons
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sorted.map(season => {
          const isCurrent = season.season_number === currentSeason;
          return (
            <DropdownMenuItem key={season.id} asChild className="px-4">
              <Link
                href={`/tv-series/${seriesId}/season/${season.season_number}`}
                className={`flex flex-col ${isCurrent ? "pointer-events-none opacity-60" : ""}`}
              >
                <span className="text-sm font-medium">Season {season.season_number}</span>
                <span className="text-[11px] text-muted-foreground">
                  {season.episode_count} episodes{isCurrent ? " • Current" : ""}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
