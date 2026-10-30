"use client";

import {
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import debounce from "lodash/debounce";
import {
  Film,
  Tv,
  Search,
  SearchX,
  Sparkles,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MediaCard } from "@/components/media/media-card";
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
  const [{ urlQuery, rawQuery }, setQuery] = useState({
    urlQuery: query,
    rawQuery: query,
  });
  if (urlQuery !== query) {
    setQuery({ urlQuery: query, rawQuery: query });
  }
  const debouncedQuery = query.trim();
  const modeParam = searchParams.get("mode");
  const mode: SearchMode =
    modeParam === "movie" || modeParam === "tv" ? modeParam : "multi";

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
          setQuery((current) => ({ ...current, urlQuery: trimmed }));
          window.history.replaceState(null, "", url);
        });
      }, 300),
    [setQuery],
  );

  const setMode = (newMode: SearchMode) => {
    const url = new URL(window.location.href);
    if (
      newMode === "multi"
        ? !url.searchParams.has("mode")
        : url.searchParams.get("mode") === newMode
    )
      return;
    if (newMode === "multi") url.searchParams.delete("mode");
    else url.searchParams.set("mode", newMode);
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  };

  const onChangeQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery((current) => ({ ...current, rawQuery: v }));
    debouncedUpdate(v);
  };

  const {
    data,
    error,
    isLoading: loading,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useTMDBSearchFeed(debouncedQuery, mode);

  const results = useMemo(
    () => [
      ...new Map(
        (data?.pages || [])
          .flatMap((p) => p.results)
          .filter((r) => r.media_type === "movie" || r.media_type === "tv")
          .map((r) => [`${r.media_type}-${r.id}`, r] as const),
      ).values(),
    ],
    [data?.pages],
  );
  const { getStatus, isLoading: statusesLoading } = useMediaStatuses(
    results,
    user?.id,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingInput = rawQuery.trim() !== debouncedQuery;
  const searching =
    pendingInput || loading || (isFetching && !isFetchingNextPage);
  const mediaLabel =
    mode === "movie" ? "movies" : mode === "tv" ? "TV series" : "titles";
  const summary = searching
    ? rawQuery.trim()
      ? `Searching for “${rawQuery.trim()}”…`
      : "Clearing search…"
    : error
      ? isFetchNextPageError
        ? "Couldn’t load more results. Try again."
        : "Couldn’t refresh results. Try again."
      : debouncedQuery
        ? `${results.length} ${results.length === 1 ? "title" : "titles"} loaded for “${debouncedQuery}”${hasNextPage ? ". More results available." : "."}`
        : "Search movies and TV series.";

  const clearSearch = () => {
    setQuery((current) => ({ ...current, rawQuery: "" }));
    debouncedUpdate("");
    debouncedUpdate.flush();
    inputRef.current?.focus();
  };

  // URL changes (including same-page links) invalidate pending input.
  useEffect(() => {
    debouncedUpdate.cancel();
  }, [query, debouncedUpdate]);

  useEffect(() => {
    // Cancel even when Back/Forward restores the same q with a different mode.
    const onPopState = () => {
      debouncedUpdate.cancel();
      const restoredQuery =
        new URLSearchParams(window.location.search).get("q") || "";
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
    if (
      !sentinelRef.current ||
      !hasNextPage ||
      isFetching ||
      error ||
      pendingInput
    )
      return;
    if (typeof IntersectionObserver === "undefined") return;
    const el = sentinelRef.current;
    let requested = false;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !requested) {
        requested = true;
        void fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage, error, pendingInput]);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageTitle
        title="Search"
        subtitle="Find your next watch, or a familiar favorite"
      />

      {/* Search Controls */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4">
        {/* Search Input */}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            debouncedUpdate(rawQuery);
            debouncedUpdate.flush();
            if (debouncedQuery && rawQuery.trim() === debouncedQuery)
              void refetch();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 size-5 text-muted-foreground"
            />
            <Input
              id="search-input"
              ref={inputRef}
              name="q"
              autoComplete="off"
              enterKeyHint="search"
              type="search"
              placeholder="Search movies and TV series…"
              value={rawQuery}
              onChange={onChangeQuery}
              className="pl-12 h-12 text-base rounded-xl [&::-webkit-search-cancel-button]:hidden"
              aria-label="Search movies or TV series"
              aria-controls={
                debouncedQuery || pendingInput ? "search-results" : undefined
              }
            />
          </div>
          {rawQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X aria-hidden="true" />
            </Button>
          )}
          <Button type="submit" size="sm" className="rounded-xl">
            Search
          </Button>
        </form>

        {/* Mode Filters */}
        <div
          role="group"
          aria-label="Media type"
          className="flex flex-wrap gap-2"
        >
          <ModeButton
            active={mode === "multi"}
            onClick={() => setMode("multi")}
            icon={<Sparkles data-icon="inline-start" aria-hidden="true" />}
          >
            All
          </ModeButton>
          <ModeButton
            active={mode === "movie"}
            onClick={() => setMode("movie")}
            icon={<Film data-icon="inline-start" aria-hidden="true" />}
          >
            Movies
          </ModeButton>
          <ModeButton
            active={mode === "tv"}
            onClick={() => setMode("tv")}
            icon={<Tv data-icon="inline-start" aria-hidden="true" />}
          >
            TV Series
          </ModeButton>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {pendingInput
          ? "Updating search…"
          : isFetchingNextPage
            ? "Loading more titles…"
            : summary}
      </p>

      {/* Results */}
      {!debouncedQuery && !pendingInput && (
        <EmptyState
          icon={Search}
          title="What are you looking for?"
          description="Search a title to see what you’ve watched, or save something for later."
        />
      )}

      {(debouncedQuery || pendingInput) && (
        <section
          id="search-results"
          aria-label="Search results"
          aria-busy={searching || isFetchingNextPage}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="min-w-0 break-words font-semibold">
              {searching ? summary : `Results for “${debouncedQuery}”`}
            </h2>
            {!searching && results.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {results.length} loaded
              </span>
            )}
          </div>
          {pendingInput && results.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing matches for “{debouncedQuery}” while your search updates.
            </p>
          )}

          {debouncedQuery &&
            !searching &&
            results.length === 0 &&
            !error &&
            !hasNextPage && (
              <EmptyState
                icon={SearchX}
                title={`No ${mediaLabel} found`}
                description={`No matches for “${debouncedQuery}”. Try another title or check your spelling.`}
                action={
                  <>
                    {mode !== "multi" && (
                      <Button type="button" onClick={() => setMode("multi")}>
                        Search all titles
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearSearch}
                    >
                      Clear search
                    </Button>
                  </>
                }
              />
            )}

          {error && !isFetchNextPageError && results.length === 0 && (
            <EmptyState
              icon={TriangleAlert}
              title="We couldn’t load results"
              description="Your search is still here. Try loading the results again."
              action={
                <Button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  Retry search
                </Button>
              }
            />
          )}

          <ul className="border-t border-border/50">
            {loading &&
              results.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  aria-hidden="true"
                  className="flex items-center gap-3 border-b border-border/50 py-4"
                >
                  <Skeleton className="h-18 w-12 shrink-0" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </li>
              ))}
            {results.map((r) => (
              <li key={`${r.media_type}-${r.id}`}>
                <MediaCard
                  item={r}
                  status={getStatus(r.id, r.media_type)}
                  statusLoading={statusesLoading || !user?.id}
                  layout="row"
                />
              </li>
            ))}
          </ul>

          {/* Keep pagination reachable even when a page contains only people. */}
          <div ref={sentinelRef} aria-hidden="true" />
          {(hasNextPage ||
            (error && results.length > 0) ||
            isFetchNextPageError) && (
            <div className="flex flex-col items-center gap-3 py-4">
              {error && <p className="text-sm text-destructive">{summary}</p>}
              <Button
                type="button"
                variant="outline"
                disabled={isFetching || pendingInput}
                onClick={() => {
                  if (error && !isFetchNextPageError) void refetch();
                  else void fetchNextPage();
                }}
              >
                {isFetchingNextPage && (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isFetchingNextPage
                  ? "Loading more…"
                  : error
                    ? isFetchNextPageError
                      ? "Retry loading more"
                      : "Retry search"
                    : "Load more"}
              </Button>
            </div>
          )}
          {!hasNextPage && !searching && !error && results.length > 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              You’ve reached the end of these results.
            </p>
          )}
        </section>
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
      aria-pressed={active}
      variant={active ? "default" : "outline"}
      size="sm"
      className="flex items-center gap-1.5 rounded-full"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Button>
  );
}
