"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { useBatchTMDBMovies } from "@/lib/tmdb/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { TMDBSearchResult } from "@/lib/tmdb/types";

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

  const { map: detailsMap } = useBatchTMDBMovies(results.map(r => r.movieId));

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Movies</h1>
          <p className="text-sm text-muted-foreground">Tracked movies ordered by recent updates.</p>
        </div>
      </div>
      <div className="hidden md:flex flex-wrap gap-2">
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
      <div className="md:hidden flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              {status
                ? WATCH_STATUSES.find(s => s.value === status)?.label || status
                : "Filter by Status"}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover text-popover-foreground z-10 w-48 rounded-md border shadow-md">
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onSelect={() => setStatus(undefined)}
            >
              All
            </DropdownMenuItem>
            {WATCH_STATUSES.filter(s => s.value !== "currently_watching").map(s => (
              <DropdownMenuItem
                key={s.value}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onSelect={() => setStatus(s.value)}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
