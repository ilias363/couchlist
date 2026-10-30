"use client";

import { startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import debounce from "lodash/debounce";
import { Film, Tv, Search, SearchX, Sparkles, Loader2, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { SearchMode, useTMDBSearchFeed } from "@/lib/tmdb/react-query";
import { useMediaStatuses } from "@/hooks/use-media-statuses";
import { EmptyState } from "@/components/common/empty-state";
import { PageTitle } from "@/components/layout/page-title";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const query = searchParams.get("q") || "";
  const [{ urlQuery, rawQuery }, setQuery] = useState({ urlQuery: query, rawQuery: query });
  if (urlQuery !== query) {
    setQuery({ urlQuery: query, rawQuery: query });
  }
  const debouncedQuery = query.trim();
  const modeParam = searchParams.get("mode");
  const mode: SearchMode = modeParam === "movie" || modeParam === "tv" ? modeParam : "multi";

  const debouncedUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        const url = new URL(window.location.href);
        if ((url.searchParams.get("q") || "") === trimmed) return;
        if (trimmed) url.searchParams.set("q", trimmed);
        else url.searchParams.delete("q");
        // Commit the URL and its source together without replacing the typed draft.
        startTransition(() => {
          setQuery(current => ({ ...current, urlQuery: trimmed }));
          window.history.replaceState(null, "", url);
        });
      }, 500),
    [setQuery],
  );

  const setMode = (newMode: SearchMode) => {
    const url = new URL(window.location.href);
    if (newMode === "multi" ? !url.searchParams.has("mode") : url.searchParams.get("mode") === newMode) return;
    if (newMode === "multi") url.searchParams.delete("mode");
    else url.searchParams.set("mode", newMode);
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  };

  const onChangeQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(current => ({ ...current, rawQuery: v }));
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

  const results = useMemo(() => (data?.pages || []).flatMap(p => p.results), [data?.pages]);
  const { getStatus } = useMediaStatuses(results, user?.id);

  // URL changes (including same-page links) invalidate pending input.
  useEffect(() => {
    debouncedUpdate.cancel();
  }, [query, debouncedUpdate]);

  useEffect(() => {
    // Cancel even when Back/Forward restores the same q with a different mode.
    const onPopState = () => {
      debouncedUpdate.cancel();
      const restoredQuery = new URLSearchParams(window.location.search).get("q") || "";
      setQuery({ urlQuery: restoredQuery, rawQuery: restoredQuery });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

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
        <form
          className="flex items-center gap-2"
          onSubmit={event => {
            event.preventDefault();
            debouncedUpdate(rawQuery);
            debouncedUpdate.flush();
          }}
        >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
          <Input
            id="search-input"
            type="search"
            placeholder="Search for movies, TV series..."
            value={rawQuery}
            onChange={onChangeQuery}
            className="pl-12 h-12 text-base rounded-xl"
            aria-label="Search movies or TV series"
          />
          {loading && debouncedQuery && (
            <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground z-10" />
          )}
        </div>
        <Button type="submit" size="sm" className="rounded-xl">Search</Button>
        </form>

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
