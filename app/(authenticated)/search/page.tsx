"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { debounce } from "lodash";
import { Film, Tv, Search } from "lucide-react";
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
    <div className="mx-auto">
      <div className="flex flex-col items-center gap-2 md:flex-row md:justify-between">
        <label className="hidden md:block text-md font-medium" htmlFor="search-input">
          Search TMDB
        </label>
        <div className="flex-1 w-full relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-input"
            placeholder="Search for movies, TV series..."
            value={rawQuery}
            onChange={onChangeQuery}
            className="pl-9"
            aria-label="Search movies or TV series"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
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
          <ModeButton
            active={mode === "multi"}
            onClick={() => setMode("multi")}
            icon={
              <>
                <Film className="h-4 w-4" />
                <Tv className="h-4 w-4" />
              </>
            }
          >
            Both
          </ModeButton>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap py-2">
        <div className="text-sm text-muted-foreground">
          {debouncedQuery ? (loading ? "Searching..." : error ? `Error: ${error}` : "") : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {loading &&
          results.length === 0 &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
        {!loading && results.length === 0 && debouncedQuery && !error && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            No results found.
          </p>
        )}
        {error && (
          <p className="col-span-full text-center text-sm text-destructive">{error.message}</p>
        )}
        {results.map(r => (
          <MediaCard key={`${r.media_type}-${r.id}`} item={r} status={getStatus(r)} />
        ))}
      </div>

      <div ref={sentinelRef} />
      {hasNextPage && isFetchingNextPage && (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground animate-pulse">Loading…</div>
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
      className="flex items-center gap-1.5"
    >
      {icon}
      <span className="text-xs font-medium">{children}</span>
    </Button>
  );
}
