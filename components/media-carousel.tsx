import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "./media-card";

interface MediaCarouselProps {
  title: string;
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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.length === 0 &&
          isLoading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div key={i} className="w-36 sm:w-40 lg:w-44 flex-shrink-0">
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map(it => (
          <div key={it.id} className="w-36 sm:w-40 lg:w-44 flex-shrink-0 snap-start">
            <MediaCard item={it} status={getStatus(it)} />
          </div>
        ))}
        {hasNextPage && (
          <div ref={endRef} className="flex-shrink-0 flex items-center justify-center w-24">
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          </div>
        )}
      </div>
    </section>
  );
}
