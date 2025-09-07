"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { debounce } from "lodash";
import { Film, Tv, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Pagination } from "@/components/pagination";
import { SearchMode, useTMDBSearch } from "@/lib/hooks/use-tmdb-search";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [page, setPage] = useState(1);
  const [initialized, setInitialized] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isMobile = useIsMobile();

  useEffect(() => {
    if (initialized) return;
    const q = searchParams.get("q") || "";
    const m = searchParams.get("mode") as SearchMode | null;
    const p = Number(searchParams.get("page") || 1);

    setRawQuery(q);
    setDebouncedQuery(q.trim());
    if (m === "movie" || m === "tv" || m === "multi") setMode(m);
    if (!Number.isNaN(p) && p > 0) setPage(Math.floor(p));
    setInitialized(true);
  }, [initialized, searchParams]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        setPage(1);
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

  const { results, totalPages, totalResults, loading, error } = useTMDBSearch({
    query: debouncedQuery,
    page,
    mode,
  });

  useEffect(() => {
    return () => debouncedUpdate.cancel();
  }, [debouncedUpdate]);

  useEffect(() => {
    if (!initialized) return;
    const sp = new URLSearchParams();
    if (debouncedQuery) sp.set("q", debouncedQuery);
    if (mode !== "multi") sp.set("mode", mode);
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedQuery, mode, page, initialized, pathname, router]);

  function changeMode(next: SearchMode) {
    setMode(next);
    setPage(1);
  }

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
            onClick={() => changeMode("movie")}
            icon={<Film className="h-4 w-4" />}
          >
            Movies
          </ModeButton>
          <ModeButton
            active={mode === "tv"}
            onClick={() => changeMode("tv")}
            icon={<Tv className="h-4 w-4" />}
          >
            TV Series
          </ModeButton>
          <ModeButton
            active={mode === "multi"}
            onClick={() => changeMode("multi")}
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
          {debouncedQuery
            ? loading
              ? "Searching..."
              : error
              ? `Error: ${error}`
              : `${totalResults.toLocaleString()} result${totalResults === 1 ? "" : "s"}`
            : ""}
        </div>
        {!isMobile && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            loading={!!loading}
            onPageChange={setPage}
          />
        )}
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
        {error && <p className="col-span-full text-center text-sm text-destructive">{error}</p>}
        {results.map(r => (
          <MediaCard key={`${r.media_type}-${r.id}`} item={r} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            loading={!!loading}
            onPageChange={setPage}
          />
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
