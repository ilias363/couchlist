import { tmdbClient } from "./client-api";
import { useQuery } from "@tanstack/react-query";
import { TMDBMovie, TMDBSearchResponse, TMDBSeason, TMDBTvSeries } from "./types";

export const tmdbKeys = {
  all: ["tmdb"] as const,
  search: (mode: string, query: string, page: number) =>
    [...tmdbKeys.all, "search", mode, query, page] as const,
  movie: (id: number) => [...tmdbKeys.all, "movie", id] as const,
  tv: (id: number) => [...tmdbKeys.all, "tv", id] as const,
  season: (seriesId: number, seasonNumber: number) =>
    [...tmdbKeys.all, "season", seriesId, seasonNumber] as const,
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
