"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import debounce from "lodash/debounce";
import { Film, Tv, Search, SearchX, Sparkles, Loader2, TriangleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { SearchMode, useTMDBSearchFeed } from "@/lib/tmdb/react-query";
import { useUserStatuses } from "@/components/providers/user-status-provider";
import { EmptyState } from "@/components/common/empty-state";
import { PageTitle } from "@/components/layout/page-title";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const searchParams = useSearchParams();

  const [rawQuery, setRawQuery] = useState(() => searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("q") || "").trim());
  const [mode, setMode] = useState<SearchMode>(() => {
    const m = searchParams.get("mode") as SearchMode | null;
    return m === "movie" || m === "tv" || m === "multi" ? m : "multi";
  });

  const router = useRouter();
  const pathname = usePathname();

  const { getStatus } = useUserStatuses();

  const debouncedUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        setDebouncedQuery(trimmed);
      }, 500),
    [],
  );

  const onChangeQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setRawQuery(v);
    debouncedUpdate(v);
  };

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

  // Track if we've made any changes from initial URL state
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip the first render to avoid unnecessary URL update
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const sp = new URLSearchParams();
    if (debouncedQuery) sp.set("q", debouncedQuery);
    if (mode !== "multi") sp.set("mode", mode);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedQuery, mode, pathname, router]);

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="space-y-6">
      <PageTitle title="Search" subtitle="Find movies and TV series to track" />

      {/* Search Controls */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
          <Input
            id="search-input"
            placeholder="Search for movies, TV series..."
            value={rawQuery}
            onChange={onChangeQuery}
            className="pl-12 h-12 text-base rounded-xl"
            aria-label="Search movies or TV series"
          />
          {loading && debouncedQuery && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground z-10" />
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
        <EmptyState
          icon={Search}
          title="Start your search"
          description="Type in the search box above to find movies and TV series to track."
        />
      )}

      {debouncedQuery && !loading && results.length === 0 && !error && (
        <EmptyState
          icon={SearchX}
          title="No results found"
          description="Try searching with different keywords or check your spelling."
        />
      )}

      {error && (
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong"
          description={error.message}
        />
      )}

      {(loading || results.length > 0) && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {loading &&
              results.length === 0 &&
              Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
            {results.map(r => (
              <MediaCard
                key={`${r.media_type}-${r.id}`}
                item={r}
                status={getStatus(r.id, r.media_type as "movie" | "tv")}
              />
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
