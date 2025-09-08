"use client";

import { useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { TMDBTvSeries, WatchStatus } from "@/lib/tmdb/types";

type TvStatus = WatchStatus | undefined;

export default function TvSeriesPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);

  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.tv.listUserTvSeries,
    { status: status as TvStatus },
    { initialNumItems: 30 }
  );

  const [detailsMap, setDetailsMap] = useState<Map<number, TMDBTvSeries | null>>(new Map());

  useEffect(() => {
    const missingIds = results.map(m => m.tvSeriesId).filter((id: number) => !detailsMap.has(id));

    if (missingIds.length === 0) return;

    (async () => {
      const batch = await tmdbClient.batchGetTVSeriesDetails(missingIds);
      setDetailsMap(prev => new Map([...prev, ...batch]));
    })();
  }, [results, detailsMap]);

  const loading = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My TV Series</h1>
          <p className="text-sm text-muted-foreground">Tracked series ordered by recent updates.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!status ? "default" : "outline"}
          onClick={() => setStatus(undefined)}
        >
          All
        </Button>
        {WATCH_STATUSES.map(s => (
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {loading &&
          results.length === 0 &&
          Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} />)}
        {!loading && results.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            No series found.
          </p>
        )}
        {results.map(m => {
          const details = detailsMap.get(m.tvSeriesId);
          const cardItem = {
            id: m.tvSeriesId,
            name: details?.name,
            overview: details?.overview || "",
            poster_path: details?.poster_path,
            first_air_date: details?.first_air_date,
            media_type: "tv" as const,
          };
          return <MediaCard key={`tv-${m.tvSeriesId}`} item={cardItem} status={m.status} />;
        })}
      </div>
      {paginationStatus === "CanLoadMore" && (
        <div className="flex justify-center md:pt-2">
          <Button variant="outline" disabled={loading} onClick={() => loadMore(60)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
