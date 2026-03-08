"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBatchTMDBMovies, useBatchTMDBTvSeries } from "@/lib/tmdb/react-query";
import { TMDBSearchResult, MovieWatchStatus, WatchStatus } from "@/lib/tmdb/types";
import { MediaCarousel } from "../media/media-carousel";

interface UserMediaSectionProps {
  title: string;
  subtitle?: string;
  movieStatus?: MovieWatchStatus;
  tvStatus?: WatchStatus;
  secondaryTvStatus?: WatchStatus;
  limit?: number;
}

export function UserMediaSection({
  title,
  subtitle,
  movieStatus,
  tvStatus,
  secondaryTvStatus,
  limit = 20,
}: UserMediaSectionProps) {
  const movieRecords = useQuery(
    api.movie.getRecentMoviesByStatus,
    movieStatus ? { status: movieStatus, limit } : "skip",
  );
  const tvRecords = useQuery(
    api.tv.getRecentTvByStatus,
    tvStatus ? { status: tvStatus, limit } : "skip",
  );
  const secondaryTvRecords = useQuery(
    api.tv.getRecentTvByStatus,
    secondaryTvStatus ? { status: secondaryTvStatus, limit } : "skip",
  );

  const movieIds = movieRecords?.map(m => m.movieId) ?? [];
  const tvIds = Array.from(
    new Set([
      ...(tvRecords?.map(s => s.tvSeriesId) ?? []),
      ...(secondaryTvRecords?.map(s => s.tvSeriesId) ?? []),
    ])
  );

  const { map: movieMap, isLoading: moviesLoading } = useBatchTMDBMovies(movieIds, {
    enabled: movieIds.length > 0,
  });
  const { map: tvMap, isLoading: tvLoading } = useBatchTMDBTvSeries(tvIds, {
    enabled: tvIds.length > 0,
  });

  const convexLoading =
    (movieStatus && movieRecords === undefined) ||
    (tvStatus && tvRecords === undefined) ||
    (secondaryTvStatus && secondaryTvRecords === undefined);
  const tmdbLoading = (movieIds.length > 0 && moviesLoading) || (tvIds.length > 0 && tvLoading);
  const isLoading = convexLoading || tmdbLoading;

  const items = useMemo(() => {
    const tagged: { item: TMDBSearchResult; updatedAt: number }[] = [];

    if (movieRecords) {
      for (const rec of movieRecords) {
        const movie = movieMap.get(rec.movieId);
        if (!movie) continue;
        tagged.push({
          item: { ...movie, media_type: "movie" } as TMDBSearchResult,
          updatedAt: rec.updatedAt,
        });
      }
    }

    for (const records of [tvRecords, secondaryTvRecords]) {
      if (!records) continue;

      for (const rec of records) {
        const series = tvMap.get(rec.tvSeriesId);
        if (!series) continue;
        tagged.push({
          item: { ...series, media_type: "tv" } as TMDBSearchResult,
          updatedAt: rec.updatedAt,
        });
      }
    }

    tagged.sort((a, b) => b.updatedAt - a.updatedAt);
    return tagged.map(t => t.item);
  }, [movieMap, movieRecords, secondaryTvRecords, tvMap, tvRecords]);

  // Hide when no items and done loading
  if (!isLoading && items.length === 0) return null;

  return <MediaCarousel title={title} subtitle={subtitle} items={items} isLoading={!!isLoading} />;
}
