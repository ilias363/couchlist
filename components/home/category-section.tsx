"use client";

import { useEffect, useRef, useState } from "react";
import { WatchStatus } from "@/lib/tmdb/types";
import { useTMDBCategoryFeed } from "@/lib/tmdb/react-query";
import { MediaCarousel } from "../media-carousel";
import { LucideIcon } from "lucide-react";

interface CategorySectionProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  type: "movie" | "tv";
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today";
  allMovieStatuses?: Record<number, { status: WatchStatus }>;
  allTvStatuses?: Record<number, { status: WatchStatus }>;
  defer?: boolean;
}

export function CategorySection(props: CategorySectionProps) {
  const { title, subtitle, icon, defer = false } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(!defer);

  useEffect(() => {
    if (!defer || active) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setActive(true);
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [defer, active]);

  return (
    <div ref={containerRef} className="min-h-[12rem]">
      {active ? (
        <CategorySectionContent {...props} />
      ) : (
        <MediaCarousel title={title} subtitle={subtitle} icon={icon} items={[]} isLoading />
      )}
    </div>
  );
}

function CategorySectionContent({
  title,
  subtitle,
  icon,
  type,
  category,
  allMovieStatuses,
  allTvStatuses,
}: Omit<CategorySectionProps, "defer">) {
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

  return (
    <MediaCarousel
      title={title}
      subtitle={subtitle}
      icon={icon}
      items={items}
      allMovieStatuses={allMovieStatuses}
      allTvStatuses={allTvStatuses}
      isLoading={isLoading}
      hasNextPage={hasNextPage}
      endRef={endRef}
    />
  );
}
