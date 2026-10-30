"use client";

import { Suspense } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MOVIE_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { StatusFilter } from "@/components/media/status-filter";
import { EmptyState } from "@/components/common/empty-state";
import { useBatchTMDBMovies } from "@/lib/tmdb/react-query";
import { MovieWatchStatus } from "@/lib/tmdb/types";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import Link from "next/link";
import { Film, Filter, Search } from "lucide-react";

export default function MoviesPage() {
  return (
    <Suspense>
      <MoviesView />
    </Suspense>
  );
}

function MoviesView() {
  const searchParams = useSearchParams();

  const statusParam = searchParams.get("status");
  const status = MOVIE_STATUSES.some(s => s.value === statusParam)
    ? statusParam
    : undefined;

  const setStatus = (newStatus: string | undefined) => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (newStatus ? params.get("status") === newStatus : !params.has("status")) return;
    if (newStatus) {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  };

  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.movie.listUserMovies,
    { status: status as MovieWatchStatus | undefined },
    { initialNumItems: 30 },
  );

  const { map: detailsMap } = useBatchTMDBMovies(results.map(r => r.movieId));

  const loading =
    paginationStatus === "LoadingFirstPage" ||
    paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      <PageTitle
        title="My Movies"
        subtitle="Tracked movies ordered by recent updates"
      />

      <StatusFilter
        options={MOVIE_STATUSES}
        value={status}
        onChange={setStatus}
      />

      {/* Results Grid */}
      {!loading && results.length === 0 ? (
        <EmptyState
          icon={status ? Filter : Film}
          title={status ? "Nothing with this status" : "No movies yet"}
          description={
            status
              ? "Try a different filter, or add movies from search."
              : "Search for a movie to start building your collection."
          }
          action={
            <>
              {status && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatus(undefined)}
                >
                  Clear filter
                </Button>
              )}
              <Button asChild size="sm" className="gap-2">
                <Link href="/search?mode=movie">
                  <Search className="size-4" aria-hidden="true" />
                  Search movies
                </Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {loading &&
            results.length === 0 &&
            Array.from({ length: 12 }).map((_, i) => (
              <MediaCardSkeleton key={i} />
            ))}
          {results.map(m => {
            const details = detailsMap.get(m.movieId);
            if (!details)
              return <MediaCardSkeleton key={`movie-${m.movieId}`} />;
            const item = { ...details, media_type: "movie" as const };
            return (
              <MediaCard
                key={`movie-${m.movieId}`}
                item={item}
                status={m.status}
              />
            );
          })}
        </div>
      )}

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
