"use client";

import { useEffect, useRef, useState } from "react";
import { useCatchUpData } from "@/hooks/use-catch-up-data";
import { MediaCarousel, type MediaCarouselItem } from "../media/media-carousel";
import Link from "next/link";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Button } from "@/components/ui/button";
import { CatchUpBoundary } from "@/components/catch-up/catch-up-boundary";

export function CatchUpSection() {
  const { user } = useAuth();
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
      {active && user ? <CatchUpBoundary key={user.id}><CatchUpSectionContent /></CatchUpBoundary> : (
        <MediaCarousel title="Catch Up" subtitle="Check for new episodes" items={[]} isLoading />
      )}
    </div>
  );
}

function CatchUpSectionContent() {
  const { catchUpItems, isLoading, totalUnwatchedEpisodes, isComplete, isUpdating, failedShows, retry } = useCatchUpData();

  const items: MediaCarouselItem[] = catchUpItems.map(item => ({
    id: item.tvSeriesId,
    name: item.name,
    original_name: item.name,
    overview:
      item.unwatchedEpisodes > 0
        ? `${item.unwatchedEpisodes} unwatched episode${item.unwatchedEpisodes !== 1 ? "s" : ""}`
        : item.unknownDateEpisodes > 0 ? `${item.unknownDateEpisodes} episodes with unknown air dates`
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
    watchStatus: "up_to_date",
  }));

  if (isComplete && items.length === 0) return null;

  const subtitle =
    totalUnwatchedEpisodes > 0
      ? `${isComplete ? "" : "At least "}${totalUnwatchedEpisodes} episode${totalUnwatchedEpisodes !== 1 ? "s" : ""} to catch up on`
      : "Check for new episodes";

  return (
    <div className="flex flex-col gap-3">
      <MediaCarousel title="Catch Up" subtitle={subtitle} items={items} isLoading={isLoading} />
      {!isComplete && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {isUpdating ? "Your library is being updated. " : failedShows ? "Some shows could not be checked. " : "Showing completed checks for recent shows. "}
          <Link href="/tv-series/catch-up" className="underline">View all catch-up checks</Link>
          {failedShows > 0 && <Button variant="ghost" size="sm" onClick={retry}>Retry</Button>}
        </p>
      )}
    </div>
  );
}
