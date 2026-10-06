"use client";

import { useState } from "react";
import { ChartNoAxesColumnIncreasing, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function EpisodeRatingsDrawer({ seriesId, name }: { seriesId: number; name: string }) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" title="View episode ratings on SeriesGraph">
          <ChartNoAxesColumnIncreasing data-icon="inline-start" aria-hidden="true" />
          Episode ratings
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="h-dvh w-full gap-0 sm:w-[90vw] sm:max-w-5xl"
      >
        <SheetHeader className="shrink-0 border-b pr-16 pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetTitle>Episode ratings</SheetTitle>
          <SheetDescription className="truncate">{name} · SeriesGraph</SheetDescription>
        </SheetHeader>
        <iframe
          key={reloadKey}
          src={`https://seriesgraph.com/show/${seriesId}#show-chart-container`}
          title={`${name} episode ratings on SeriesGraph`}
          className="min-h-0 w-full flex-1 border-0"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <p className="text-xs text-muted-foreground">
            Ratings provided by SeriesGraph
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReloadKey(key => key + 1)}
            aria-label="Reload episode ratings"
          >
            <RotateCw data-icon="inline-start" aria-hidden="true" />
            Reload
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
