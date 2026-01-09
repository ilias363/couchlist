"use client";

import Link from "next/link";
import { ChevronDown, ArrowLeft, Calendar, Play, Check, X } from "lucide-react";
import { TMDBSeason, BaseTMDBSeason } from "@/lib/tmdb/types";
import { PosterImage } from "@/components/media/tmdb-image";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { WatchedDateDialog } from "@/components/media/watched-date-dialog";
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
  seriesName,
}: {
  season: TMDBSeason;
  allWatched: boolean;
  anyWatched: boolean;
  bulkUpdating: boolean;
  onMarkAllWatched: (watchedAt?: number) => void;
  onMarkAllUnwatched: () => void;
  seasons?: BaseTMDBSeason[];
  seriesId: number;
  seriesName?: string;
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
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/tv-series/${seriesId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to {seriesName || "Series"}</span>
      </Link>

      {/* Main content */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Poster */}
        <div className="shrink-0 mx-auto md:mx-0">
          <div className="w-40 sm:w-44 md:w-52 rounded-xl overflow-hidden shadow-xl ring-1 ring-white/10">
            <PosterImage src={season.poster_path} alt={season.name} size="w342" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold">{season.name}</h1>
              <SeasonSwitcher
                seriesId={seriesId}
                seasons={seasons}
                currentSeason={season.season_number}
              />
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Play className="h-4 w-4" />
                {season.episodes.length} episodes
              </div>
              {season.air_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(season.air_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {season.overview && (
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto md:mx-0">
              {season.overview}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 pt-2">
            {bulkUpdating ? (
              <Button disabled className="gap-2">
                <span className="animate-pulse">Updating...</span>
              </Button>
            ) : (
              <>
                {!allWatched && (
                  <Button
                    variant="default"
                    disabled={season.episodes.length === 0}
                    onClick={handleMarkAllWatchedClick}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Mark All Watched
                  </Button>
                )}
                {anyWatched && (
                  <Button
                    variant="outline"
                    disabled={season.episodes.length === 0}
                    onClick={onMarkAllUnwatched}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Mark All Unwatched
                  </Button>
                )}
              </>
            )}
          </div>
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
        <Button size="sm" variant="outline" className="gap-1.5 h-8 rounded-full">
          Switch Season
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {sorted.map(season => {
          const isCurrent = season.season_number === currentSeason;
          return (
            <DropdownMenuItem key={season.id} asChild className="px-4 py-2.5">
              <Link
                href={`/tv-series/${seriesId}/season/${season.season_number}`}
                className={`flex flex-col gap-0.5 ${
                  isCurrent ? "pointer-events-none bg-muted" : ""
                }`}
              >
                <span className="font-medium">Season {season.season_number}</span>
                <span className="text-xs text-muted-foreground">
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
