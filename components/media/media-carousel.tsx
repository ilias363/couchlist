"use client";

import { TMDBSearchResult } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "./media-card";
import { LucideIcon } from "lucide-react";
import { useUserStatuses } from "@/components/providers/user-status-provider";

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: TMDBSearchResult[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  endRef?: React.RefObject<HTMLDivElement | null>;
  placeholderCount?: number;
}

export function MediaCarousel({
  title,
  subtitle,
  icon: Icon,
  items,
  isLoading = false,
  hasNextPage = false,
  endRef,
  placeholderCount = 10,
}: MediaCarouselProps) {
  const { getStatus } = useUserStatuses();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent -mx-2 px-2">
        {items.length === 0 &&
          isLoading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div key={i} className="w-40 sm:w-44 lg:w-52 shrink-0">
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map(it => (
          <div key={it.id} className="w-40 sm:w-44 lg:w-52 shrink-0 snap-start">
            <MediaCard item={it} status={getStatus(it.id, it.media_type as "movie" | "tv")} />
          </div>
        ))}
        {hasNextPage && (
          <div ref={endRef} className="shrink-0 flex items-center justify-center w-20">
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          </div>
        )}
      </div>
    </section>
  );
}
