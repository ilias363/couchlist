"use client";

import { useEffect, useState, useRef } from "react";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { TMDBSearchResult } from "@/lib/tmdb/types";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";

interface CategorySectionProps {
  title: string;
  type: "movie" | "tv";
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today";
  allMovieStatuses?: Record<number, { status: string }>;
  allTvStatuses?: Record<number, { status: string }>;
  initialPage?: number;
}

export function CategorySection({
  title,
  type,
  category,
  allMovieStatuses,
  allTvStatuses,
  initialPage = 1,
}: CategorySectionProps) {
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState<TMDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPage(p: number) {
      setLoading(true);
      try {
        let resp: any;
        if (category === "trending") {
          resp =
            type === "movie"
              ? await tmdbClient.getTrendingMovies(p)
              : await tmdbClient.getTrendingTv(p);
        } else if (category === "popular") {
          resp =
            type === "movie"
              ? await tmdbClient.getPopularMovies(p)
              : await tmdbClient.getPopularTv(p);
        } else if (category === "top_rated") {
          resp =
            type === "movie"
              ? await tmdbClient.getTopRatedMovies(p)
              : await tmdbClient.getTopRatedTv(p);
        } else if (category === "now_playing" && type === "movie") {
          resp = await tmdbClient.getNowPlayingMovies(p);
        } else if (category === "airing_today" && type === "tv") {
          resp = await tmdbClient.getAiringTodayTv(p);
        } else {
          resp = { results: [], total_pages: p, page: p };
        }
        if (!cancelled) {
          setItems(prev => [...prev, ...resp.results]);
          if (resp.total_pages && p >= resp.total_pages) setHasMore(false);
          if (!resp.results || resp.results.length === 0) setHasMore(false);
        }
      } catch (e) {
        console.error("Category fetch failed", e);
        if (!cancelled) setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPage(page);

    return () => {
      cancelled = true;
    };
  }, [page, category, type]);

  // Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;
    const node = endRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) setPage(p => p + 1);
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const getStatus = (item: TMDBSearchResult) => {
    const isMovie = (item.media_type ?? (item.title ? "movie" : "tv")) === "movie";
    if (isMovie) return allMovieStatuses?.[item.id]?.status;
    return allTvStatuses?.[item.id]?.status;
  };

  const placeholderCount = 10;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.length === 0 &&
          loading &&
          Array.from({ length: placeholderCount }).map((_, i) => (
            <div key={i} className="w-36 sm:w-40 lg:w-44 flex-shrink-0">
              <MediaCardSkeleton />
            </div>
          ))}
        {items.map(it => (
          <div key={`${type}-${category}-${it.id}`} className="w-36 sm:w-40 lg:w-44 flex-shrink-0">
            <MediaCard
              item={{ ...it, media_type: (it.media_type || (it.title ? "movie" : "tv")) as any }}
              status={getStatus(it) as any}
            />
          </div>
        ))}
        {hasMore && (
          <div ref={endRef} className="flex-shrink-0 flex items-center justify-center w-24">
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          </div>
        )}
      </div>
    </section>
  );
}
