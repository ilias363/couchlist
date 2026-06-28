"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserStatuses } from "@/components/providers/user-status-provider";
import {
  useBatchTMDBMovies,
  useBatchTMDBTvSeries,
  useTMDBCategoryFeed,
} from "@/lib/tmdb/react-query";
import type {
  Genre,
  TMDBMovie,
  TMDBSearchResult,
  TMDBTvSeries,
  WatchStatus,
} from "@/lib/tmdb/types";

const MAX_CANDIDATES = 6;

export type HeroMode = "loading" | "onboarding" | "personalized";
export type HeroSource = "continue" | "watchlist" | "trending";

export interface HeroFeature {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  year?: string;
  voteAverage: number;
  genres: Genre[];
  runtimeMinutes: number | null;
  status: WatchStatus | null;
  source: HeroSource;
}

interface Candidate {
  id: number;
  mediaType: "movie" | "tv";
  updatedAt: number;
  priority: number; // 0 = continue watching, 1 = watchlist
}

function yearFromDate(date?: string | null) {
  return date ? date.slice(0, 4) : undefined;
}

function movieToFeature(
  movie: TMDBMovie,
  source: HeroSource,
  status: WatchStatus | null,
): HeroFeature {
  return {
    id: movie.id,
    mediaType: "movie",
    title: movie.title,
    overview: movie.overview,
    backdropPath: movie.backdrop_path,
    posterPath: movie.poster_path,
    year: yearFromDate(movie.release_date),
    voteAverage: movie.vote_average,
    genres: movie.genres ?? [],
    runtimeMinutes: movie.runtime ?? null,
    status,
    source,
  };
}

function tvToFeature(
  tv: TMDBTvSeries,
  source: HeroSource,
  status: WatchStatus | null,
): HeroFeature {
  return {
    id: tv.id,
    mediaType: "tv",
    title: tv.name,
    overview: tv.overview,
    backdropPath: tv.backdrop_path,
    posterPath: tv.poster_path,
    year: yearFromDate(tv.first_air_date),
    voteAverage: tv.vote_average,
    genres: tv.genres ?? [],
    runtimeMinutes: tv.episode_run_time?.[0] ?? null,
    status,
    source,
  };
}

function searchResultToFeature(item: TMDBSearchResult): HeroFeature | null {
  if (item.media_type === "movie") {
    return {
      id: item.id,
      mediaType: "movie",
      title: item.title,
      overview: item.overview,
      backdropPath: item.backdrop_path,
      posterPath: item.poster_path,
      year: yearFromDate(item.release_date),
      voteAverage: item.vote_average,
      genres: [],
      runtimeMinutes: null,
      status: null,
      source: "trending",
    };
  }
  if (item.media_type === "tv") {
    return {
      id: item.id,
      mediaType: "tv",
      title: item.name,
      overview: item.overview,
      backdropPath: item.backdrop_path,
      posterPath: item.poster_path,
      year: yearFromDate(item.first_air_date),
      voteAverage: item.vote_average,
      genres: [],
      runtimeMinutes: null,
      status: null,
      source: "trending",
    };
  }
  return null;
}

/**
 * Picks the single item to spotlight at the top of the home page.
 *
 * Priority: most recently updated "continue watching" item, then the most
 * recent watchlist item, then (for users with nothing active, or none at all)
 * a trending title. All of the underlying queries are already issued by the
 * home page's sections, so this adds no extra network cost.
 */
export function useHomeHero(): { mode: HeroMode; feature: HeroFeature | null } {
  const { movieStatuses, tvStatuses, getStatus, isLoading: statusesLoading } = useUserStatuses();

  const hasAnyTracked =
    Object.keys(movieStatuses).length > 0 || Object.keys(tvStatuses).length > 0;
  const recentsArg = hasAnyTracked ? undefined : "skip";

  const continueMovies = useQuery(
    api.movie.getRecentMoviesByStatus,
    recentsArg ?? { statuses: ["on_hold"], limit: 20 },
  );
  const watchlistMovies = useQuery(
    api.movie.getRecentMoviesByStatus,
    recentsArg ?? { statuses: ["want_to_watch"], limit: 20 },
  );
  const continueTv = useQuery(
    api.tv.getRecentTvByStatus,
    recentsArg ?? { statuses: ["currently_watching", "on_hold"], limit: 20 },
  );
  const watchlistTv = useQuery(
    api.tv.getRecentTvByStatus,
    recentsArg ?? { statuses: ["want_to_watch"], limit: 20 },
  );

  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = [];
    for (const r of continueMovies ?? [])
      list.push({ id: r.movieId, mediaType: "movie", updatedAt: r.updatedAt, priority: 0 });
    for (const r of continueTv ?? [])
      list.push({ id: r.tvSeriesId, mediaType: "tv", updatedAt: r.updatedAt, priority: 0 });
    for (const r of watchlistMovies ?? [])
      list.push({ id: r.movieId, mediaType: "movie", updatedAt: r.updatedAt, priority: 1 });
    for (const r of watchlistTv ?? [])
      list.push({ id: r.tvSeriesId, mediaType: "tv", updatedAt: r.updatedAt, priority: 1 });
    list.sort((a, b) => a.priority - b.priority || b.updatedAt - a.updatedAt);
    return list.slice(0, MAX_CANDIDATES);
  }, [continueMovies, continueTv, watchlistMovies, watchlistTv]);

  const movieIds = useMemo(
    () => candidates.filter(c => c.mediaType === "movie").map(c => c.id),
    [candidates],
  );
  const tvIds = useMemo(
    () => candidates.filter(c => c.mediaType === "tv").map(c => c.id),
    [candidates],
  );

  const { map: movieMap, isLoading: moviesLoading } = useBatchTMDBMovies(movieIds, {
    enabled: movieIds.length > 0,
  });
  const { map: tvMap, isLoading: tvLoading } = useBatchTMDBTvSeries(tvIds, {
    enabled: tvIds.length > 0,
  });

  const { data: trendingData, isLoading: trendingLoading } = useTMDBCategoryFeed(
    "movie",
    "trending",
  );

  const trendingFeature = useMemo<HeroFeature | null>(() => {
    const results = trendingData?.pages.flatMap(p => p.results) ?? [];
    const withBackdrop = results.find(r => r.media_type !== "person" && r.backdrop_path);
    const chosen = withBackdrop ?? results.find(r => r.media_type !== "person");
    return chosen ? searchResultToFeature(chosen) : null;
  }, [trendingData]);

  const candidateFeature = useMemo<HeroFeature | null>(() => {
    let firstWithDetails: HeroFeature | null = null;
    for (const c of candidates) {
      const source: HeroSource = c.priority === 0 ? "continue" : "watchlist";
      const status = getStatus(c.id, c.mediaType) ?? null;
      const feature =
        c.mediaType === "movie"
          ? (() => {
              const m = movieMap.get(c.id);
              return m ? movieToFeature(m, source, status) : null;
            })()
          : (() => {
              const t = tvMap.get(c.id);
              return t ? tvToFeature(t, source, status) : null;
            })();
      if (!feature) continue;
      if (!firstWithDetails) firstWithDetails = feature;
      if (feature.backdropPath) return feature;
    }
    return firstWithDetails;
  }, [candidates, movieMap, tvMap, getStatus]);

  // --- Resolve mode ---

  if (statusesLoading) {
    return { mode: "loading", feature: null };
  }

  if (!hasAnyTracked) {
    if (!trendingFeature && trendingLoading) return { mode: "loading", feature: null };
    return { mode: "onboarding", feature: trendingFeature };
  }

  const recentsLoading =
    continueMovies === undefined ||
    continueTv === undefined ||
    watchlistMovies === undefined ||
    watchlistTv === undefined;
  const detailsPending =
    candidates.length > 0 && !candidateFeature && (moviesLoading || tvLoading);

  if (recentsLoading || detailsPending) {
    return { mode: "loading", feature: null };
  }

  if (candidateFeature) {
    return { mode: "personalized", feature: candidateFeature };
  }

  // Tracked items exist but nothing is in progress / on the watchlist.
  if (trendingFeature) return { mode: "personalized", feature: trendingFeature };
  if (trendingLoading) return { mode: "loading", feature: null };
  return { mode: "personalized", feature: null };
}
