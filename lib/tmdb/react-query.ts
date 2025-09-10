import { tmdbClient } from "./client-api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { TMDBMovie, TMDBSearchResponse, TMDBSeason, TMDBTvSeries } from "./types";

export const tmdbKeys = {
  all: ["tmdb"] as const,
  search: (mode: string, query: string, page: number) =>
    [...tmdbKeys.all, "search", mode, query, page] as const,
  movie: (id: number) => [...tmdbKeys.all, "movie", id] as const,
  tv: (id: number) => [...tmdbKeys.all, "tv", id] as const,
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

export function useTMDBTvSeries(id: number) {
  return useQuery<TMDBTvSeries>({
    queryKey: tmdbKeys.tv(id),
    queryFn: () => tmdbClient.getTVSeriesDetails(id),
  });
}

export function useTMDBSeason(seriesId: number, seasonNumber: number) {
  return useQuery<TMDBSeason>({
    queryKey: tmdbKeys.season(seriesId, seasonNumber),
    queryFn: () => tmdbClient.getSeasonDetails(seriesId, seasonNumber),
  });
}

export type SearchMode = "movie" | "tv" | "multi";

export function useTMDBSearchQuery(query: string, page: number, mode: SearchMode) {
  query = query.trim();
  return useQuery<TMDBSearchResponse>({
    queryKey: tmdbKeys.search(mode, query, page),
    enabled: !!query,
    queryFn: () => {
      if (mode === "movie") return tmdbClient.searchMovies(query, page);
      if (mode === "tv") return tmdbClient.searchTVSeries(query, page);
      return tmdbClient.searchMulti(query, page);
    },
    select: data => ({
      ...data,
      results: data.results.filter(r => r.media_type !== "person"),
    }),
  });
}

export function useTMDBCategoryFeed(
  type: "movie" | "tv",
  category: "trending" | "popular" | "top_rated" | "now_playing" | "airing_today"
) {
  return useInfiniteQuery({
    initialPageParam: 1,
    queryKey: tmdbKeys.category(type, category),
    getNextPageParam: (lastPage: TMDBSearchResponse, _pages, lastPageParam) => {
      if (lastPage.results.length === 0) return undefined;
      if (lastPageParam >= lastPage.total_pages) return undefined;
      return lastPageParam + 1;
    },
    queryFn: ({ pageParam }) => {
      const p = pageParam;
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
