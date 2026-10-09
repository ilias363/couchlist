"use client";

import { useEffect, useRef, useState } from "react";
import { useCatchUpData } from "@/hooks/use-catch-up-data";
import { TMDBSearchResult } from "@/lib/tmdb/types";
import { MediaCarousel } from "../media/media-carousel";

export function CatchUpSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || active) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setActive(true);
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={containerRef}>
      {active ? <CatchUpSectionContent /> : (
        <MediaCarousel title="Catch Up" subtitle="Check for new episodes" items={[]} isLoading />
      )}
    </div>
  );
}

function CatchUpSectionContent() {
  const { catchUpItems, isLoading, totalUnwatchedEpisodes } = useCatchUpData();

  const items: TMDBSearchResult[] = catchUpItems.map(item => ({
    id: item.tvSeriesId,
    name: item.name,
    original_name: item.name,
    overview:
      item.unwatchedEpisodes > 0
        ? `${item.unwatchedEpisodes} unwatched episode${item.unwatchedEpisodes !== 1 ? "s" : ""}`
        : `${item.upcomingSeasons.length} upcoming season${item.upcomingSeasons.length !== 1 ? "s" : ""}`,
    poster_path: item.posterPath,
    backdrop_path: null,
    popularity: 0,
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    original_language: "",
    first_air_date: "",
    origin_country: [],
    adult: false,
    media_type: "tv" as const,
  }));

  if (!isLoading && items.length === 0) return null;

  const subtitle =
    totalUnwatchedEpisodes > 0
      ? `${totalUnwatchedEpisodes} episode${totalUnwatchedEpisodes !== 1 ? "s" : ""} to catch up on`
      : "Check for new episodes";

  return <MediaCarousel title="Catch Up" subtitle={subtitle} items={items} isLoading={isLoading} />;
}
