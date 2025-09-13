/********************************* Pagination *********************************/

export interface PaginatedTMDBResponse<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

/********************************* Movie *********************************/

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface MovieExternalIDs {
  imdb_id: string | null;
  wikidata_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

export interface BaseTMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
  release_date: string;
  video: boolean;
}

export interface TMDBMovie extends BaseTMDBMovie {
  budget: number;
  genres: Genre[];
  homepage: string | null;
  imdb_id: string | null;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  revenue: number;
  runtime: number | null;
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string | null;
}

export interface ExtendedTMDBMovie extends TMDBMovie {
  external_ids: MovieExternalIDs;
  recommendations: PaginatedTMDBResponse<BaseTMDBMovie>;
  similar: PaginatedTMDBResponse<BaseTMDBMovie>;
}

/********************************* Episode *********************************/

export interface BaseTMDBEpisode {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  air_date: string | null;
  episode_number: number;
  season_number: number;
  production_code: string | null;
  runtime: number;
  still_path: string | null;
  show_id: number;
}

export interface SeasonEpisode extends Omit<BaseTMDBEpisode, "show_id"> {
  crew: CrewMember[];
  guest_stars: GuestStar[];
}

/********************************* Season *********************************/

export interface CrewMember {
  job: string;
  department: string;
  credit_id: string;
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
}

export interface GuestStar {
  character: string;
  credit_id: string;
  order: number;
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
}

export interface BaseTMDBSeason {
  air_date: string | null;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

export interface TMDBSeason extends Omit<BaseTMDBSeason, "episode_count"> {
  _id: string;
  episodes: SeasonEpisode[];
}

/********************************* Tv Series *********************************/

export interface Network {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface Creator {
  id: number;
  credit_id: string;
  name: string;
  gender: number | null;
  profile_path: string | null;
}

export interface TvSeriesExternalIDs {
  imdb_id: string | null;
  tvdb_id: string | null;
  wikidata_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

export interface BaseTMDBTvSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  first_air_date: string;
  origin_country: string[];
  adult: boolean;
}

export interface TMDBTvSeries extends BaseTMDBTvSeries {
  created_by: Creator[];
  episode_run_time: number[];
  genres: Genre[];
  homepage: string | null;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: BaseTMDBEpisode | null;
  next_episode_to_air: string | null;
  networks: Network[];
  number_of_episodes: number;
  number_of_seasons: number;
  original_name: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  seasons: BaseTMDBSeason[];
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string | null;
  type: string;
}

export interface ExtendedTMDBTvSeries extends TMDBTvSeries {
  external_ids: TvSeriesExternalIDs;
  recommendations: PaginatedTMDBResponse<BaseTMDBTvSeries>;
  similar: PaginatedTMDBResponse<BaseTMDBTvSeries>;
}

/********************************* Person *********************************/

// Not used currently in the app, but defined for completeness
export interface BaseTMDBPerson {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  adult: boolean;
  gender: number;
  known_for_department: string;
  popularity: number;
}

/********************************* Search *********************************/

export type TMDBSearchResult =
  | (BaseTMDBMovie & { media_type: "movie" })
  | (BaseTMDBTvSeries & { media_type: "tv" })
  | (BaseTMDBPerson & { media_type: "person" });

export type TMDBSearchResponse = PaginatedTMDBResponse<TMDBSearchResult>;

/********************************* Common *********************************/

export type WatchStatus =
  | "want_to_watch"
  | "currently_watching"
  | "watched"
  | "on_hold"
  | "dropped";

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";
export type BackdropSize = "w300" | "w780" | "w1280" | "original";
export type StillSize = "w92" | "w185" | "w300" | "original";
export type LogoSize = "w45" | "w92" | "w154" | "w185" | "w300" | "w500" | "original";
export type ProfileSize = "w92" | "w185" | "w300" | "original";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
