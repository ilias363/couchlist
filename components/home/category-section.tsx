"use client";

import { useEffect, useRef } from "react";
import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { useTMDBCategoryFeed } from "@/lib/tmdb/react-query";

interface CategorySectionProps {
  title: string;
  type: "movie" | "tv";
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today";
  allMovieStatuses?: Record<number, { status: WatchStatus }>;
  allTvStatuses?: Record<number, { status: WatchStatus }>;
}

export function CategorySection({
  title,
  type,
  category,
  allMovieStatuses,
  allTvStatuses,
}: CategorySectionProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const { data, isFetching, fetchNextPage, hasNextPage, isLoading } = useTMDBCategoryFeed(
    type,
    category
  );

  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    if (!hasNextPage) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const items = data?.pages.flatMap(page => page.results) || [];

  const getStatus = (item: TMDBSearchResult) => {
    if (item.media_type === "movie") return allMovieStatuses?.[item.id]?.status;
    return allTvStatuses?.[item.id]?.status;
  };

  const placeholderCount = 10;

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
          <div
            key={`${type}-${category}-${it.id}`}
            className="w-36 sm:w-40 lg:w-44 flex-shrink-0 snap-start"
          >
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
