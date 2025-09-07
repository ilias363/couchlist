import { TMDB_BASE_URL, TMDBMovie, TMDBSearchResponse, TMDBSeason, TMDBTvSeries } from "./types";

export class TMDBClient {
    private apiKey: string;
    private cache: Map<string, { data: unknown; timestamp: number }>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.cache = new Map();
    }

    private isValidCache(timestamp: number): boolean {
        return Date.now() - timestamp < this.CACHE_DURATION;
    }

    private async makeRequest<T>(endpoint: string): Promise<T> {
        // Check cache first
        const cacheKey = endpoint;
        const cached = this.cache.get(cacheKey);

        if (cached && this.isValidCache(cached.timestamp)) {
            return cached.data as T;
        }

        const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${this.apiKey
            }`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                // Rate limited, wait and retry
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.makeRequest<T>(endpoint);
            }
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        this.cache.set(cacheKey, { data, timestamp: Date.now() });

        return data;
    }

    // Search functions
    async searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse> {
        return this.makeRequest(`/search/movie?query=${encodeURIComponent(query)}&page=${page}`);
    }

    async searchTVSeries(query: string, page: number = 1): Promise<TMDBSearchResponse> {
        return this.makeRequest(`/search/tv?query=${encodeURIComponent(query)}&page=${page}`);
    }

    async searchMulti(query: string, page: number = 1): Promise<TMDBSearchResponse> {
        return this.makeRequest(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
    }

    // Details functions
    async getMovieDetails(movieId: number): Promise<TMDBMovie> {
        return this.makeRequest(`/movie/${movieId}`);
    }

    async getTVSeriesDetails(seriesId: number): Promise<TMDBTvSeries> {
        return this.makeRequest(`/tv/${seriesId}`);
    }

    async getSeasonDetails(seriesId: number, seasonNumber: number): Promise<TMDBSeason> {
        return this.makeRequest(`/tv/${seriesId}/season/${seasonNumber}`);
    }

    // Batch operations for efficient data fetching
    async batchGetMovieDetails(movieIds: number[]): Promise<Map<number, TMDBMovie | null>> {
        const results = new Map<number, TMDBMovie | null>();

        // Process in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < movieIds.length; i += batchSize) {
            const batch = movieIds.slice(i, i + batchSize);
            const promises = batch.map(async id => {
                try {
                    const movie = await this.getMovieDetails(id);
                    return { id, movie };
                } catch (error) {
                    console.error(`Failed to fetch movie ${id}:`, error);
                    return { id, movie: null };
                }
            });

            const batchResults = await Promise.all(promises);
            batchResults.forEach(({ id, movie }) => {
                results.set(id, movie);
            });
        }

        return results;
    }

    async batchGetTVSeriesDetails(seriesIds: number[]): Promise<Map<number, TMDBTvSeries | null>> {
        const results = new Map<number, TMDBTvSeries | null>();

        // Process in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < seriesIds.length; i += batchSize) {
            const batch = seriesIds.slice(i, i + batchSize);
            const promises = batch.map(async id => {
                try {
                    const series = await this.getTVSeriesDetails(id);
                    return { id, series };
                } catch (error) {
                    console.error(`Failed to fetch TV series ${id}:`, error);
                    return { id, series: null };
                }
            });

            const batchResults = await Promise.all(promises);
            batchResults.forEach(({ id, series }) => {
                results.set(id, series);
            });
        }

        return results;
    }

    async batchGetMixedDetails(
        items: Array<{ type: "movie" | "tv"; tmdbId: number }>
    ): Promise<Map<string, TMDBMovie | TMDBTvSeries | null>> {
        const results = new Map<string, TMDBMovie | TMDBTvSeries | null>();

        const movieIds = items.filter(item => item.type === "movie").map(item => item.tmdbId);
        const tvIds = items.filter(item => item.type === "tv").map(item => item.tmdbId);

        const [movieResults, tvResults] = await Promise.all([
            this.batchGetMovieDetails(movieIds),
            this.batchGetTVSeriesDetails(tvIds),
        ]);

        movieResults.forEach((movie, id) => {
            results.set(`movie-${id}`, movie);
        });

        tvResults.forEach((series, id) => {
            results.set(`tv-${id}`, series);
        });

        return results;
    }
}

export const tmdbClient = new TMDBClient(process.env.NEXT_PUBLIC_TMDB_API_KEY!);
