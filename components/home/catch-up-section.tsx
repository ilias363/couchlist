"use client";

import { useCatchUpData } from "@/hooks/use-catch-up-data";
import { TMDBSearchResult } from "@/lib/tmdb/types";
import { MediaCarousel } from "../media/media-carousel";

export function CatchUpSection() {
  const { catchUpItems, isLoading, totalUnwatchedEpisodes } = useCatchUpData();

  if (!isLoading && catchUpItems.length === 0) return null;

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

  const subtitle =
    totalUnwatchedEpisodes > 0
      ? `${totalUnwatchedEpisodes} episode${totalUnwatchedEpisodes !== 1 ? "s" : ""} to catch up on`
      : "Check for new episodes";

  return <MediaCarousel title="Catch Up" subtitle={subtitle} items={items} isLoading={isLoading} />;
}
