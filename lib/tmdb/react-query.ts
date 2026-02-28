import { tmdbClient } from "./client-api";
import { QueryClient, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ExtendedTMDBMovie,
  ExtendedTMDBTvSeries,
  TMDBMovie,
  TMDBSearchResponse,
  TMDBSeason,
  TMDBTvSeries,
} from "./types";

export const tmdbKeys = {
  all: ["tmdb"] as const,
  searchFeed: (mode: string, query: string) => [...tmdbKeys.all, "search", mode, query] as const,
  movie: (id: number) => [...tmdbKeys.all, "movie", id] as const,
  movieExtended: (id: number) => [...tmdbKeys.all, "movie", id, "extended"] as const,
  tv: (id: number) => [...tmdbKeys.all, "tv", id] as const,
  tvExtended: (id: number) => [...tmdbKeys.all, "tv", id, "extended"] as const,
  season: (seriesId: number, seasonNumber: number) =>
    [...tmdbKeys.all, "season", seriesId, seasonNumber] as const,
  category: (type: "movie" | "tv", category: string) =>
    [...tmdbKeys.all, "category", type, category] as const,
};

type QueryOptions = {
  enabled?: boolean;
};

function uniquePositiveIds(ids: number[]) {
  return Array.from(new Set(ids.filter((id): id is number => Number.isFinite(id) && id > 0)));
}

export function useTMDBMovie(id: number, options?: QueryOptions) {
  return useQuery<TMDBMovie>({
    queryKey: tmdbKeys.movie(id),
    queryFn: () => tmdbClient.getMovieDetails(id),
    enabled: options?.enabled ?? true,
  });
}

export function useTMDBExtendedMovie(id: number, options?: QueryOptions) {
  return useQuery<ExtendedTMDBMovie>({
    queryKey: tmdbKeys.movieExtended(id),
    queryFn: () => tmdbClient.getExtendedMovieDetails(id),
    enabled: options?.enabled ?? true,
  });
}

export function useTMDBTvSeries(id: number, options?: QueryOptions) {
  return useQuery<TMDBTvSeries>({
    queryKey: tmdbKeys.tv(id),
    queryFn: () => tmdbClient.getTVSeriesDetails(id),
    enabled: options?.enabled ?? true,
  });
}

export function useTMDBExtendedTvSeries(id: number, options?: QueryOptions) {
  return useQuery<ExtendedTMDBTvSeries>({
    queryKey: tmdbKeys.tvExtended(id),
    queryFn: () => tmdbClient.getExtendedTVSeriesDetails(id),
    enabled: options?.enabled ?? true,
  });
}

export function useTMDBSeason(seriesId: number, seasonNumber: number, options?: QueryOptions) {
  return useQuery<TMDBSeason>({
    queryKey: tmdbKeys.season(seriesId, seasonNumber),
    queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
    enabled: options?.enabled ?? true,
  });
}

export function useBatchTMDBMovies(ids: number[], options?: QueryOptions) {
  const stableIds = useMemo(() => uniquePositiveIds(ids), [ids]);
  const enabled = (options?.enabled ?? true) && stableIds.length > 0;

  const queries = useQueries({
    queries: stableIds.map(id => ({
      queryKey: tmdbKeys.movie(id),
      queryFn: () => tmdbClient.getMovieDetails(id),
      enabled,
    })),
  });

  const map = useMemo(() => {
    const next = new Map<number, TMDBMovie | null>();
    queries.forEach((q, i) => {
      const id = stableIds[i];
      if (id) next.set(id, q.data || null);
    });
    return next;
  }, [queries, stableIds]);

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export function useBatchTMDBTvSeries(ids: number[], options?: QueryOptions) {
  const stableIds = useMemo(() => uniquePositiveIds(ids), [ids]);
  const enabled = (options?.enabled ?? true) && stableIds.length > 0;

  const queries = useQueries({
    queries: stableIds.map(id => ({
      queryKey: tmdbKeys.tv(id),
      queryFn: () => tmdbClient.getTVSeriesDetails(id),
      enabled,
    })),
  });

  const map = useMemo(() => {
    const next = new Map<number, TMDBTvSeries | null>();
    queries.forEach((q, i) => {
      const id = stableIds[i];
      if (id) next.set(id, q.data || null);
    });
    return next;
  }, [queries, stableIds]);

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export function useBatchTMDBSeasons(
  seriesId: number,
  seasonNumbers: number[],
  options?: QueryOptions
) {
  const stableSeasonNumbers = useMemo(
    () => uniquePositiveIds(seasonNumbers),
    [seasonNumbers]
  );
  const enabled = (options?.enabled ?? true) && stableSeasonNumbers.length > 0;

  const queries = useQueries({
    queries: stableSeasonNumbers.map(seasonNumber => ({
      queryKey: tmdbKeys.season(seriesId, seasonNumber),
      queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
      enabled,
    })),
  });

  const map = useMemo(() => {
    const next = new Map<number, TMDBSeason | null>();
    queries.forEach((q, i) => {
      const seasonNumber = stableSeasonNumbers[i];
      if (seasonNumber) next.set(seasonNumber, q.data || null);
    });
    return next;
  }, [queries, stableSeasonNumbers]);

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export type SearchMode = "movie" | "tv" | "multi";

export function useTMDBSearchFeed(query: string, mode: SearchMode, options?: QueryOptions) {
  const q = query.trim();
  return useInfiniteQuery<TMDBSearchResponse>({
    initialPageParam: 1,
    queryKey: tmdbKeys.searchFeed(mode, q),
    enabled: options?.enabled ?? !!q,
    getNextPageParam: lastPage => {
      if (lastPage.results.length === 0) return undefined;
      if (lastPage.page >= lastPage.total_pages) return undefined;
      return lastPage.page + 1;
    },
    queryFn: ({ pageParam }) => {
      const p = pageParam as number;
      if (mode === "movie") return tmdbClient.searchMovies(q, p);
      if (mode === "tv") return tmdbClient.searchTVSeries(q, p);
      return tmdbClient.searchMulti(q, p);
    },
    select: data => ({
      pageParams: data.pageParams,
      pages: data.pages.map(page => ({
        ...page,
        results: page.results.filter(r => r.media_type !== "person"),
      })),
    }),
  });
}

export function useTMDBCategoryFeed(
  type: "movie" | "tv",
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today",
  options?: QueryOptions
) {
  return useInfiniteQuery<TMDBSearchResponse>({
    initialPageParam: 1,
    queryKey: tmdbKeys.category(type, category),
    enabled: options?.enabled ?? true,
    getNextPageParam: lastPage => {
      if (lastPage.results.length === 0) return undefined;
      if (lastPage.page >= lastPage.total_pages) return undefined;
      return lastPage.page + 1;
    },
    queryFn: ({ pageParam }) => {
      const p = pageParam as number;
      if (category === "trending")
        return type === "movie" ? tmdbClient.getTrendingMovies(p) : tmdbClient.getTrendingTv(p);
      if (category === "popular")
        return type === "movie" ? tmdbClient.getPopularMovies(p) : tmdbClient.getPopularTv(p);
      if (category === "top_rated")
        return type === "movie" ? tmdbClient.getTopRatedMovies(p) : tmdbClient.getTopRatedTv(p);
      if (category === "now_playing" && type === "movie") return tmdbClient.getNowPlayingMovies(p);
      if (category === "airing_today" && type === "tv") return tmdbClient.getAiringTodayTv(p);
      return Promise.resolve({ results: [], page: p, total_pages: p, total_results: 0 });
    },
  });
}

export function prefetchTMDBExtendedMedia(
  queryClient: QueryClient,
  mediaType: "movie" | "tv",
  id: number
) {
  if (!Number.isFinite(id) || id <= 0) return Promise.resolve(undefined);
  if (mediaType === "movie") {
    return queryClient.prefetchQuery({
      queryKey: tmdbKeys.movieExtended(id),
      queryFn: () => tmdbClient.getExtendedMovieDetails(id),
      staleTime: 1000 * 60 * 10,
    });
  }
  return queryClient.prefetchQuery({
    queryKey: tmdbKeys.tvExtended(id),
    queryFn: () => tmdbClient.getExtendedTVSeriesDetails(id),
    staleTime: 1000 * 60 * 10,
  });
}
