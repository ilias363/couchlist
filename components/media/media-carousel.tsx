"use client";

import { TMDBSearchResult } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "./media-card";
import { useUserStatuses } from "@/components/providers/user-status-provider";
import { cn } from "@/lib/utils";

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  items: TMDBSearchResult[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  endRef?: React.RefObject<HTMLDivElement | null>;
  placeholderCount?: number;
}

export function MediaCarousel({
  title,
  subtitle,
  items,
  isLoading = false,
  hasNextPage = false,
  endRef,
  placeholderCount = 10,
}: MediaCarouselProps) {
  const { getStatus } = useUserStatuses();

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-linear-to-l from-primary/50 to-transparent" />
        <div className="text-center shrink-0">
          <h2 className="font-display text-2xl tracking-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted-foreground/70 mt-1">{subtitle}</p>}
        </div>
        <div className="h-px flex-1 bg-linear-to-r from-primary/50 to-transparent" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40 -mx-2 px-2 transition-all duration-300">
        {items.length === 0 &&
          isLoading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div
              key={i}
              className="w-40 sm:w-44 lg:w-52 shrink-0"
              style={i < 8 ? { animationDelay: `${i * 0.05}s` } : undefined}
            >
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map((it, i) => (
          <div
            key={`${it.media_type}-${it.id}`}
            className={cn("w-40 sm:w-44 lg:w-52 shrink-0 snap-start", i < 8 && "animate-fade-up")}
            style={i < 8 ? { animationDelay: `${i * 0.03}s` } : undefined}
          >
            <MediaCard item={it} status={getStatus(it.id, it.media_type as "movie" | "tv")} />
          </div>
        ))}
        {hasNextPage && (
          <div ref={endRef} className="shrink-0 flex items-center justify-center w-20">
            <div className="text-xs text-primary/60 animate-pulse font-medium">Loading...</div>
          </div>
        )}
      </div>
    </section>
  );
}
