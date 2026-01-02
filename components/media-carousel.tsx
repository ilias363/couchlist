import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "./media-card";
import { LucideIcon } from "lucide-react";

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: TMDBSearchResult[];
  allMovieStatuses?: Record<number, { status: WatchStatus }>;
  allTvStatuses?: Record<number, { status: WatchStatus }>;
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
  allMovieStatuses,
  allTvStatuses,
  isLoading = false,
  hasNextPage = false,
  endRef,
  placeholderCount = 10,
}: MediaCarouselProps) {
  const getStatus = (item: TMDBSearchResult) => {
    if (item.media_type === "movie") return allMovieStatuses?.[item.id]?.status;
    return allTvStatuses?.[item.id]?.status;
  };
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
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent -mx-2 px-2">
        {items.length === 0 &&
          isLoading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div key={i} className="w-32 sm:w-36 lg:w-40 flex-shrink-0">
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map(it => (
          <div key={it.id} className="w-32 sm:w-36 lg:w-40 flex-shrink-0 snap-start">
            <MediaCard item={it} status={getStatus(it)} />
          </div>
        ))}
        {hasNextPage && (
          <div ref={endRef} className="flex-shrink-0 flex items-center justify-center w-20">
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          </div>
        )}
      </div>
    </section>
  );
}
