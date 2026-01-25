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
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40 -mx-2 px-2 transition-all duration-300">
        {items.length === 0 &&
          isLoading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div
              key={i}
              className="w-40 sm:w-44 lg:w-52 shrink-0"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map((it, i) => (
          <div
            key={it.id}
            className="w-40 sm:w-44 lg:w-52 shrink-0 snap-start animate-fade-up"
            style={{ animationDelay: `${i * 0.03}s` }}
          >
            <MediaCard item={it} status={getStatus(it.id, it.media_type as "movie" | "tv")} />
          </div>
        ))}
        {hasNextPage && (
          <div ref={endRef} className="shrink-0 flex items-center justify-center w-20">
            <div className="text-xs text-primary/60 animate-pulse font-medium">Loading…</div>
          </div>
        )}
      </div>
    </section>
  );
}
