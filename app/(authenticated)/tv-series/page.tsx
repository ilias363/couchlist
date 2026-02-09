"use client";

import { Suspense, useCallback } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media/media-card";
import { StatusFilter } from "@/components/media/status-filter";
import { WatchStatus } from "@/lib/tmdb/types";
import { useBatchTMDBTvSeries } from "@/lib/tmdb/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";

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
    [router, pathname, searchParams],
  );

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

  return (
    <div className="mx-auto space-y-6">
      <PageTitle title="My TV Series" subtitle="Tracked series ordered by recent updates" />

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
