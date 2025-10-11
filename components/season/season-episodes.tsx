"use client";

import { useState } from "react";
import { SeasonEpisode } from "@/lib/tmdb/types";
import { StillImage } from "@/components/tmdb-image";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchedDateDialog } from "@/components/watched-date-dialog";

export function SeasonEpisodes({
  episodes,
  statusMap,
  onToggle,
}: {
  episodes: SeasonEpisode[];
  statusMap: Map<number, boolean>;
  onToggle: (ep: SeasonEpisode, watchedAt?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SeasonEpisode | null>(null);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

  const handleClick = (ep: SeasonEpisode, watched: boolean) => {
    if (!watched) {
      setPending(ep);
      setDefaultMs(Date.now());
      setOpen(true);
    } else {
      onToggle(ep);
    }
  };

  const handleConfirm = (ms?: number) => {
    if (!pending) return;
    onToggle(pending, ms);
    setPending(null);
    setOpen(false);
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Episodes</h2>
      <div className="space-y-3">
        {episodes.map(ep => {
          const watched = !!statusMap.get(ep.id);
          return (
            <div
              key={ep.id}
              className={cn(
                "rounded-md border p-2 flex gap-4 items-center group",
                watched && "bg-muted/40"
              )}
            >
              <div className="w-32 shrink-0 overflow-hidden relative">
                <StillImage src={ep.still_path} alt={ep.name} size="w300" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold leading-tight truncate">
                    {ep.episode_number}. {ep.name}
                  </h3>
                  <Button
                    size="icon"
                    variant={watched ? "secondary" : "ghost"}
                    onClick={() => handleClick(ep, watched)}
                    className="h-7 w-7 shrink-0"
                  >
                    {watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ep.air_date ? new Date(ep.air_date).toLocaleDateString() : "No date"} •{" "}
                  {ep.runtime ? `${ep.runtime}m` : "--m"} • Rating{" "}
                  {ep.vote_average?.toFixed(1) ?? "N/A"}
                </p>
                {ep.overview && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{ep.overview}</p>
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
