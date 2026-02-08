"use client";

import { Suspense, useCallback } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { StatusFilter } from "@/components/media/status-filter";
import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import { useBatchTMDBTvSeries } from "@/lib/tmdb/react-query";
import { Tv } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function TvSeriesPage() {
  return (
    <Suspense>
      <TvSeriesView />
    </Suspense>
  );
}

function TvSeriesView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const statusParam = searchParams.get("status");
  const status = WATCH_STATUSES.some(s => s.value === statusParam) ? statusParam : undefined;

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
    api.tv.listUserTvSeries,
    { status: status as WatchStatus | undefined },
    { initialNumItems: 30 }
  );

  const { map: detailsMap } = useBatchTMDBTvSeries(results.map(r => r.tvSeriesId));

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Tv className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My TV Series</h1>
          <p className="text-muted-foreground text-sm">Tracked series ordered by recent updates</p>
        </div>
      </div>

      <StatusFilter options={WATCH_STATUSES} value={status} onChange={setStatus} />

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {loading &&
          results.length === 0 &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
        {!loading && results.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No series found.</p>
        )}
        {results.map(m => {
          const details = detailsMap.get(m.tvSeriesId);
          if (!details) return <MediaCardSkeleton key={`tv-${m.tvSeriesId}`} />;
          const item = { ...details, media_type: "tv" as const };
          return <MediaCard key={`tv-${m.tvSeriesId}`} item={item} status={m.status} />;
        })}
      </div>

      {paginationStatus === "CanLoadMore" && (
        <div className="flex justify-center md:pt-2">
          <Button
            variant="link"
            disabled={loading}
            onClick={() => loadMore(60)}
            className="hover:cursor-pointer"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
