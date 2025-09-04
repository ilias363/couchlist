export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    runtime?: number;
    poster_path?: string;
    backdrop_path?: string;
    imdb_id?: string;
    genres?: Array<{ id: number; name: string }>;
    production_companies?: Array<{ id: number; name: string }>;
    vote_average?: number;
    vote_count?: number;
}

export interface TMDBTVSeries {
    id: number;
    name: string;
    overview: string;
    first_air_date: string;
    last_air_date?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    poster_path?: string;
    backdrop_path?: string;
    status?: string;
    genres?: Array<{ id: number; name: string }>;
    created_by?: Array<{ id: number; name: string }>;
    seassons?: (Omit<TMDBSeason, "episodes"> & { episode_count: number })[];
    vote_average?: number;
    vote_count?: number;
}

export interface TMDBSeason {
    id: number;
    season_number: number;
    name: string;
    overview: string;
    air_date?: string;
    poster_path?: string;
    episodes?: TMDBEpisode[];
}

export interface TMDBEpisode {
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    overview: string;
    air_date?: string;
    runtime?: number;
    still_path?: string;
    vote_average?: number;
}

export interface TMDBSearchResult {
    id: number;
    title?: string; // for movies
    name?: string; // for TV series
    overview: string;
    release_date?: string; // for movies
    first_air_date?: string; // for TV series
    poster_path?: string;
    media_type?: "movie" | "tv" | "person";
}

export interface TMDBSearchResponse {
    page: number;
    total_pages: number;
    total_results: number;
    results: TMDBSearchResult[];
}

export type WatchStatus =
    | "want_to_watch"
    | "currently_watching"
    | "watched"
    | "on_hold"
    | "dropped";

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";
export type BackdropSize = "w300" | "w780" | "w1280" | "original";
export type StillSize = "w92" | "w185" | "w300" | "original";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";