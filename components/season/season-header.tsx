"use client";

import { Calendar, Check, X } from "lucide-react";
import type { TMDBSeason } from "@/lib/tmdb/types";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/common/confirm-dialog";

export function SeasonHeader({
  season,
  allWatched,
  anyWatched,
  bulkUpdating,
  onMarkAllWatched,
  onMarkAllUnwatched,
}: {
  season: TMDBSeason;
  allWatched: boolean;
  anyWatched: boolean;
  bulkUpdating: boolean;
  onMarkAllWatched: () => void | Promise<void>;
  onMarkAllUnwatched: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{season.name}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{season.episodes.length} episodes</span>
            {season.air_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" aria-hidden="true" />
                {new Date(`${season.air_date}T00:00:00`).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bulkUpdating ? <Button disabled size="sm">Updating...</Button> : (
            <>
              {!allWatched && (
                <ConfirmButton
                  size="sm"
                  disabled={season.episodes.length === 0}
                  onConfirm={onMarkAllWatched}
                  title="Mark All Episodes as Watched?"
                  description="Already-watched episodes keep their dates. Newly watched episodes will have unknown dates."
                  confirmText="Watch All"
                >
                  <Check data-icon="inline-start" aria-hidden="true" />
                  Mark season watched
                </ConfirmButton>
              )}
              {anyWatched && (
                <ConfirmButton
                  size="sm"
                  variant="outline"
                  onConfirm={onMarkAllUnwatched}
                  title="Unwatch all episodes?"
                  description="This will remove all watched dates for this season."
                  confirmText="Unwatch All"
                >
                  <X data-icon="inline-start" aria-hidden="true" />
                  Unwatch season
                </ConfirmButton>
              )}
            </>
          )}
        </div>
      </div>
      {season.overview && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{season.overview}</p>}
    </div>
  );
}
