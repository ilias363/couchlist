"use client";

import { useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { TMDBMovie } from "@/lib/tmdb/types";

type MovieStatus = "want_to_watch" | "watched" | "on_hold" | "dropped" | undefined;

export default function MoviesPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);

  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.movie.listUserMovies,
    { status: status as MovieStatus },
    { initialNumItems: 30 }
  );

  const [detailsMap, setDetailsMap] = useState<Map<number, TMDBMovie | null>>(new Map());

  useEffect(() => {
    const missingIds = results.map(m => m.movieId).filter((id: number) => !detailsMap.has(id));

    if (missingIds.length === 0) return;

    (async () => {
      const batch = await tmdbClient.batchGetMovieDetails(missingIds);
      setDetailsMap(prev => new Map([...prev, ...batch]));
    })();
  }, [results, detailsMap]);

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Movies</h1>
          <p className="text-sm text-muted-foreground">Tracked movies ordered by recent updates.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!status ? "default" : "outline"}
          onClick={() => setStatus(undefined)}
        >
          All
        </Button>
        {WATCH_STATUSES.filter(s => s.value !== "currently_watching").map(s => (
          <Button
            key={s.value}
            size="sm"
            variant={status === s.value ? "default" : "outline"}
            onClick={() => setStatus(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {loading &&
          results.length === 0 &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
        {!loading && results.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            No movies found.
          </p>
        )}
        {results.map(m => {
          const details = detailsMap.get(m.movieId);
          const cardItem = {
            id: m.movieId,
            title: details?.title,
            overview: details?.overview || "",
            poster_path: details?.poster_path,
            release_date: details?.release_date,
            media_type: "movie" as const,
          };
          return <MediaCard key={`movie-${m.movieId}`} item={cardItem} status={m.status} />;
        })}
      </div>

      {paginationStatus === "CanLoadMore" && (
        <div className="flex justify-center md:pt-2">
          <Button variant="outline" disabled={loading} onClick={() => loadMore(30)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
