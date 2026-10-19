import "server-only";

import { TMDBClient } from "./client-api";
import { TMDB_BASE_URL } from "./types";

export function fetchTMDB(endpoint: string, signal?: AbortSignal) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured.");

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  return fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
    redirect: "error",
    next: { revalidate: 300 },
  });
}

export const tmdbServerClient = new TMDBClient(fetchTMDB);
