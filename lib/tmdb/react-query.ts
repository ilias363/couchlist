import { tmdbClient } from "./client-api";
import { useInfiniteQuery, useQuery, useQueries } from "@tanstack/react-query";
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

export function useTMDBMovie(id: number) {
  return useQuery<TMDBMovie>({
    queryKey: tmdbKeys.movie(id),
    queryFn: () => tmdbClient.getMovieDetails(id),
  });
}

export function useTMDBExtendedMovie(id: number) {
  return useQuery<ExtendedTMDBMovie>({
    queryKey: tmdbKeys.movieExtended(id),
    queryFn: () => tmdbClient.getExtendedMovieDetails(id),
  });
}

export function useTMDBTvSeries(id: number) {
  return useQuery<TMDBTvSeries>({
    queryKey: tmdbKeys.tv(id),
    queryFn: () => tmdbClient.getTVSeriesDetails(id),
  });
}

export function useTMDBExtendedTvSeries(id: number) {
  return useQuery<ExtendedTMDBTvSeries>({
    queryKey: tmdbKeys.tvExtended(id),
    queryFn: () => tmdbClient.getExtendedTVSeriesDetails(id),
  });
}

export function useTMDBSeason(seriesId: number, seasonNumber: number) {
  return useQuery<TMDBSeason>({
    queryKey: tmdbKeys.season(seriesId, seasonNumber),
    queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
  });
}

export function useBatchTMDBMovies(ids: number[]) {
  const queries = useQueries({
    queries: ids.map(id => ({
      queryKey: tmdbKeys.movie(id),
      queryFn: () => tmdbClient.getMovieDetails(id),
    })),
  });

  const map = new Map<number, TMDBMovie | null>();
  queries.forEach((q, i) => {
    const id = ids[i];
    if (id) map.set(id, q.data || null);
  });

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export function useBatchTMDBTvSeries(ids: number[]) {
  const queries = useQueries({
    queries: ids.map(id => ({
      queryKey: tmdbKeys.tv(id),
      queryFn: () => tmdbClient.getTVSeriesDetails(id),
    })),
  });

  const map = new Map<number, TMDBTvSeries | null>();
  queries.forEach((q, i) => {
    const id = ids[i];
    if (id) map.set(id, q.data || null);
  });

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export function useBatchTMDBSeasons(seriesId: number, seasonNumbers: number[]) {
  const queries = useQueries({
    queries: seasonNumbers.map(seasonNumber => ({
      queryKey: tmdbKeys.season(seriesId, seasonNumber),
      queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
    })),
  });

  const map = new Map<number, TMDBSeason | null>();
  queries.forEach((q, i) => {
    const seasonNumber = seasonNumbers[i];
    if (seasonNumber) map.set(seasonNumber, q.data || null);
  });

  const isLoading = queries.some(q => q.isLoading);
  const isFetching = queries.some(q => q.isFetching);
  return { map, queries, isLoading, isFetching };
}

export type SearchMode = "movie" | "tv" | "multi";

export function useTMDBSearchFeed(query: string, mode: SearchMode) {
  const q = query.trim();
  return useInfiniteQuery<TMDBSearchResponse>({
    initialPageParam: 1,
    queryKey: tmdbKeys.searchFeed(mode, q),
    enabled: !!q,
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
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today"
) {
  return useInfiniteQuery<TMDBSearchResponse>({
    initialPageParam: 1,
    queryKey: tmdbKeys.category(type, category),
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
