import {
  ExtendedTMDBMovie,
  ExtendedTMDBTvSeries,
  TMDB_BASE_URL,
  TMDBMovie,
  TMDBSearchResponse,
  TMDBSearchResult,
  TMDBSeason,
  TMDBTvSeries,
} from "./types";

export class TMDBClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${this.apiKey}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
      // React Query owns the bounded retry policy, including rate-limit errors.
      throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private addMediaTypeToResults(results: TMDBSearchResult[], mediaType: "movie" | "tv") {
    return results.map(r => ({ ...r, media_type: mediaType })) as TMDBSearchResult[];
  }

  async searchMovies(query: string, page: number = 1, signal?: AbortSignal): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}`,
      signal
    );
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "movie"),
    };
  }

  async searchTVSeries(query: string, page: number = 1, signal?: AbortSignal): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(
      `/search/tv?query=${encodeURIComponent(query)}&page=${page}`,
      signal
    );
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "tv"),
    };
  }

  async searchMulti(query: string, page: number = 1, signal?: AbortSignal): Promise<TMDBSearchResponse> {
    return this.makeRequest(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`, signal);
  }

  async getMovieDetails(movieId: number): Promise<TMDBMovie> {
    return this.makeRequest(`/movie/${movieId}`);
  }

  async getExtendedMovieDetails(movieId: number): Promise<ExtendedTMDBMovie> {
    return this.makeRequest(
      `/movie/${movieId}?append_to_response=external_ids,recommendations,similar,credits`
    );
  }

  async getTVSeriesDetails(seriesId: number): Promise<TMDBTvSeries> {
    return this.makeRequest(`/tv/${seriesId}`);
  }

  async getExtendedTVSeriesDetails(seriesId: number): Promise<ExtendedTMDBTvSeries> {
    return this.makeRequest(
      `/tv/${seriesId}?append_to_response=external_ids,recommendations,similar,credits`
    );
  }

  async getSeasonDetails(seriesId: number, seasonNumber: number): Promise<TMDBSeason> {
    return this.makeRequest(`/tv/${seriesId}/season/${seasonNumber}`);
  }

  async getTrendingMovies(page: number = 1): Promise<TMDBSearchResponse> {
    return this.makeRequest(`/trending/movie/week?page=${page}`);
  }

  async getTrendingTv(page: number = 1): Promise<TMDBSearchResponse> {
    return this.makeRequest(`/trending/tv/week?page=${page}`);
  }

  async getPopularMovies(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/movie/popular?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "movie"),
    };
  }

  async getPopularTv(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/tv/popular?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "tv"),
    };
  }

  async getTopRatedMovies(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/movie/top_rated?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "movie"),
    };
  }

  async getTopRatedTv(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/tv/top_rated?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "tv"),
    };
  }

  async getNowPlayingMovies(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/movie/now_playing?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "movie"),
    };
  }

  async getAiringTodayTv(page: number = 1): Promise<TMDBSearchResponse> {
    const resp: TMDBSearchResponse = await this.makeRequest(`/tv/airing_today?page=${page}`);
    return {
      ...resp,
      results: this.addMediaTypeToResults(resp.results, "tv"),
    };
  }
}

export const tmdbClient = new TMDBClient(process.env.NEXT_PUBLIC_TMDB_API_KEY!);
