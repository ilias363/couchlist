import { useEffect, useState } from "react";
import { TMDBSearchResult } from "@/lib/tmdb/types";
import { tmdbClient } from "@/lib/tmdb/client-api";

export type SearchMode = "movie" | "tv" | "multi";

interface UseTMDBSearchArgs {
    query: string;
    page: number;
    mode: SearchMode;
}

interface UseTMDBSearchResult {
    results: TMDBSearchResult[];
    totalPages: number;
    totalResults: number;
    loading: boolean;
    error: string | null;
}

export function useTMDBSearch({ query, page, mode }: UseTMDBSearchArgs): UseTMDBSearchResult {
    const [state, setState] = useState<UseTMDBSearchResult>({
        results: [],
        totalPages: 0,
        totalResults: 0,
        loading: false,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!query.trim()) {
                setState(prev => ({
                    ...prev,
                    results: [],
                    totalPages: 0,
                    totalResults: 0,
                    loading: false,
                    error: null,
                }));
                return;
            }
            setState(prev => ({ ...prev, loading: true, error: null }));
            try {
                const data =
                    mode === "movie"
                        ? await tmdbClient.searchMovies(query, page)
                        : mode === "tv"
                            ? await tmdbClient.searchTVSeries(query, page)
                            : await tmdbClient.searchMulti(query, page);
                if (cancelled) return;
                // Filter people results out in multi mode
                const filtered = data.results.filter(r => r.media_type !== "person");
                setState({
                    results: filtered,
                    totalPages: data.total_pages,
                    totalResults: data.total_results,
                    loading: false,
                    error: null,
                });
            } catch (e: any) {
                if (cancelled) return;
                setState(prev => ({ ...prev, loading: false, error: e.message || "Search failed" }));
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [query, page, mode]);

    return state;
}