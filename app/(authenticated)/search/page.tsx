"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { debounce } from "lodash";
import { Film, Tv, Search, Sparkles, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { SearchMode, useTMDBSearchFeed } from "@/lib/tmdb/react-query";
import { useQueries } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("multi");
  const [initialized, setInitialized] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { allMovieStatuses, allTvStatuses } = useQueries({
    allMovieStatuses: { query: api.movie.listAllMovieStatuses, args: {} },
    allTvStatuses: { query: api.tv.listAllTvStatuses, args: {} },
  });

  useEffect(() => {
    if (initialized) return;
    const q = searchParams.get("q") || "";
    const m = searchParams.get("mode") as SearchMode | null;
    setRawQuery(q);
    setDebouncedQuery(q.trim());
    if (m === "movie" || m === "tv" || m === "multi") setMode(m);
    setInitialized(true);
  }, [initialized, searchParams]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        setDebouncedQuery(trimmed);
      }, 500),
    []
  );

  const onChangeQuery = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setRawQuery(v);
      debouncedUpdate(v);
    },
    [debouncedUpdate]
  );

  const {
    data,
    error,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useTMDBSearchFeed(debouncedQuery, mode);

  const results = (data?.pages || []).flatMap(p => p.results);

  useEffect(() => {
    return () => debouncedUpdate.cancel();
  }, [debouncedUpdate]);

  useEffect(() => {
    if (!initialized) return;
    const sp = new URLSearchParams();
    if (debouncedQuery) sp.set("q", debouncedQuery);
    if (mode !== "multi") sp.set("mode", mode);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedQuery, mode, initialized, pathname, router]);

  const getStatus = (item: TMDBSearchResult) => {
    if (item.media_type === "movie")
      return allMovieStatuses?.[item.id]?.status as WatchStatus | undefined;
    return allTvStatuses?.[item.id]?.status as WatchStatus | undefined;
  };

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasNextPage) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, debouncedQuery, mode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Search className="h-7 w-7 text-primary" />
          Search
        </h1>
        <p className="text-muted-foreground">Find movies and TV series from The Movie Database</p>
      </div>

      {/* Search Controls */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="search-input"
            placeholder="Search for movies, TV series..."
            value={rawQuery}
            onChange={onChangeQuery}
            className="pl-12 h-12 text-base rounded-xl bg-background"
            aria-label="Search movies or TV series"
          />
          {loading && debouncedQuery && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Mode Filters */}
        <div className="flex flex-wrap gap-2">
          <ModeButton
            active={mode === "multi"}
            onClick={() => setMode("multi")}
            icon={<Sparkles className="h-4 w-4" />}
          >
            All
          </ModeButton>
          <ModeButton
            active={mode === "movie"}
            onClick={() => setMode("movie")}
            icon={<Film className="h-4 w-4" />}
          >
            Movies
          </ModeButton>
          <ModeButton
            active={mode === "tv"}
            onClick={() => setMode("tv")}
            icon={<Tv className="h-4 w-4" />}
          >
            TV Series
          </ModeButton>
        </div>
      </div>

      {/* Results */}
      {!debouncedQuery && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Start your search</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Type in the search box above to find movies and TV series
          </p>
        </div>
      )}

      {debouncedQuery && !loading && results.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No results found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Try searching with different keywords or check your spelling
          </p>
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-destructive">{error.message}</p>
        </div>
      )}

      {(loading || results.length > 0) && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {loading &&
              results.length === 0 &&
              Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
            {results.map(r => (
              <MediaCard key={`${r.media_type}-${r.id}`} item={r} status={getStatus(r)} />
            ))}
          </div>

          <div ref={sentinelRef} />
          {hasNextPage && isFetchingNextPage && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading more...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

function ModeButton({ active, onClick, children, icon }: ModeButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? "default" : "outline"}
      size="sm"
      className="flex items-center gap-1.5 rounded-full"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Button>
  );
}
