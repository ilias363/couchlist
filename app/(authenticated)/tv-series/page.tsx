"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { StatusFilter } from "@/components/media/status-filter";
import { EmptyState } from "@/components/common/empty-state";
import { WatchStatus } from "@/lib/tmdb/types";
import { useBatchTMDBTvSeries } from "@/lib/tmdb/react-query";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import Link from "next/link";
import { CalendarClock, Filter, Search, Tv, Loader2 } from "lucide-react";

export default function TvSeriesPage() {
  return (
    <Suspense>
      <TvSeriesView />
    </Suspense>
  );
}

function TvSeriesView() {
  const searchParams = useSearchParams();

  const statusParam = searchParams.get("status");
  const status = WATCH_STATUSES.some(s => s.value === statusParam) ? statusParam : undefined;

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
    api.tv.listUserTvSeries,
    { status: status as WatchStatus | undefined },
    { initialNumItems: 30 },
  );

  const { map: detailsMap } = useBatchTMDBTvSeries(results.map(r => r.tvSeriesId));

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || paginationStatus !== "CanLoadMore") return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore(60);
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [paginationStatus, loadMore, results.length, status]);

  return (
    <div className="mx-auto space-y-6">
      <PageTitle
        title="My TV Series"
        subtitle="Tracked series ordered by recent updates"
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/tv-series/catch-up">
              <CalendarClock className="size-4" aria-hidden="true" />
              Catch Up
            </Link>
          </Button>
        }
      />

      <StatusFilter options={WATCH_STATUSES} value={status} onChange={setStatus} />

      {/* Results Grid */}
      {!loading && results.length === 0 ? (
        <EmptyState
          icon={status ? Filter : Tv}
          title={status ? "Nothing with this status" : "No series yet"}
          description={
            status
              ? "Try a different filter, or add series from search."
              : "Search for a show to start tracking your progress."
          }
          action={
            <>
              {status && (
                <Button variant="outline" size="sm" onClick={() => setStatus(undefined)}>
                  Clear filter
                </Button>
              )}
              <Button asChild size="sm" className="gap-2">
                <Link href="/search?mode=tv">
                  <Search className="size-4" aria-hidden="true" />
                  Search series
                </Link>
              </Button>
            </>
          }
        />
      ) : (
        <div aria-busy={loading} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {loading &&
            results.length === 0 &&
            Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
          {results.map(m => {
            const details = detailsMap.get(m.tvSeriesId);
            if (!details) return <MediaCardSkeleton key={`tv-${m.tvSeriesId}`} />;
            const item = { ...details, media_type: "tv" as const };
            return <MediaCard key={`tv-${m.tvSeriesId}`} item={item} status={m.status} />;
          })}
        </div>
      )}

      <p role="status" className="sr-only">
        {paginationStatus === "LoadingFirstPage" ? "Loading series…" : ""}
      </p>
      <div ref={sentinelRef} />
      {paginationStatus === "LoadingMore" && (
        <div role="status" className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Loading more...</span>
        </div>
      )}
    </div>
  );
}
