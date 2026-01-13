"use client";

import { Suspense, useCallback } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MOVIE_STATUSES, WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { StatusFilter } from "@/components/media/status-filter";
import { useBatchTMDBMovies } from "@/lib/tmdb/react-query";
import { Clapperboard } from "lucide-react";
import { TMDBSearchResult, MovieWatchStatus } from "@/lib/tmdb/types";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function MoviesPage() {
  return (
    <Suspense>
      <MoviesView />
    </Suspense>
  );
}

function MoviesView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const statusParam = searchParams.get("status");
  const status = MOVIE_STATUSES.some(s => s.value === statusParam) ? statusParam : undefined;

  const setStatus = useCallback(
    (newStatus: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newStatus) {
        params.set("status", newStatus);
      } else {
        params.delete("status");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.movie.listUserMovies,
    { status: status as MovieWatchStatus | undefined },
    { initialNumItems: 30 }
  );

  const { map: detailsMap } = useBatchTMDBMovies(results.map(r => r.movieId));

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Clapperboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Movies</h1>
          <p className="text-muted-foreground text-sm">Tracked movies ordered by recent updates</p>
        </div>
      </div>

      <StatusFilter options={MOVIE_STATUSES} value={status} onChange={setStatus} />

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {loading &&
          results.length === 0 &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
        {!loading && results.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No movies found.</p>
        )}
        {results.map(m => {
          const details = detailsMap.get(m.movieId);
          const item = { ...details, media_type: "movie" } as TMDBSearchResult;
          return <MediaCard key={`movie-${m.movieId}`} item={item} status={m.status} />;
        })}
      </div>

      {paginationStatus === "CanLoadMore" && (
        <div className="flex justify-center md:pt-2">
          <Button
            variant="link"
            disabled={loading}
            onClick={() => loadMore(30)}
            className="hover:cursor-pointer"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
