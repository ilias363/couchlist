"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import Link from "next/link";
import { PosterImage } from "./tmdb-image";
import { Film, Tv } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MOVIE_STATUSES, WATCH_STATUSES } from "@/lib/tmdb/utils";
import { WatchedDateDialog } from "@/components/media/watched-date-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMovieStatus } from "@/hooks/use-movie-status";
import { useTvSeriesStatus } from "@/hooks/use-tv-status";
import { useSeasonData } from "@/hooks/use-season-data";
import { useTMDBMovie, useTMDBTvSeries } from "@/lib/tmdb/react-query";
import { MediaCardMenu } from "./media-card-menu";

interface MediaCardProps {
  item: TMDBSearchResult;
  status?: WatchStatus | null;
  className?: string;
}

export function MediaCard({ item, status, className }: MediaCardProps) {
  const isMovie = item.media_type === "movie";
  const isTv = item.media_type === "tv";
  const title = isMovie ? item.title : isTv ? item.name : "";
  const date = isMovie ? item.release_date : isTv ? item.first_air_date : undefined;
  const itemLink = isMovie ? `/movies/${item.id}` : isTv ? `/tv-series/${item.id}` : "#";

  const [menuOpen, setMenuOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus | null>(status ?? null);
  const [watchedDialogDefaultMs, setWatchedDialogDefaultMs] = useState<number | undefined>(
    undefined
  );
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setCurrentStatus(status ?? null);
  }, [status]);

  const statusOptions = useMemo(() => (isMovie ? MOVIE_STATUSES : WATCH_STATUSES), [isMovie]);

  const { data: movieDetails } = useTMDBMovie(item.id, { enabled: isMovie && menuOpen });
  const { data: tvDetails } = useTMDBTvSeries(item.id, { enabled: isTv && menuOpen });

  const movieStatus = useMovieStatus(
    isMovie ? item.id : 0,
    isMovie ? movieDetails?.runtime : undefined
  );
  const tvStatus = useTvSeriesStatus(isTv ? item.id : 0);

  const { filteredSeasons, fetchAllSeasons } = useSeasonData(
    isTv ? item.id : 0,
    isTv ? tvDetails?.seasons : undefined
  );

  const updating = isMovie ? movieStatus.updating : tvStatus.updating;
  const watchedDialogOpen = isMovie ? movieStatus.watchedDialogOpen : tvStatus.watchedDialogOpen;

  const statusLabel = currentStatus
    ? WATCH_STATUSES.find(s => s.value === currentStatus)?.label
    : undefined;

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (isMovie) {
        movieStatus.setWatchedDialogOpen(open);
      } else {
        tvStatus.setWatchedDialogOpen(open);
      }

      if (!open) {
        setWatchedDialogDefaultMs(undefined);
      }
    },
    [isMovie, movieStatus, tvStatus]
  );

  const handleStatusSelect = useCallback(
    async (nextStatus: WatchStatus) => {
      if (nextStatus === currentStatus) {
        setMenuOpen(false);
        return;
      }

      if (nextStatus === "watched") {
        setWatchedDialogDefaultMs(Date.now());
        if (isMovie) {
          movieStatus.handleStatusClick(nextStatus);
        } else {
          tvStatus.handleStatusClick(nextStatus);
        }
        setMenuOpen(false);
        return;
      }

      try {
        if (isMovie) {
          await movieStatus.handleStatusChange(nextStatus);
        } else {
          await tvStatus.handleStatusChange(nextStatus);
        }
        setCurrentStatus(nextStatus);
      } finally {
        setMenuOpen(false);
      }
    },
    [currentStatus, isMovie, movieStatus, tvStatus]
  );

  const handleWatchedConfirm = useCallback(
    async (watchedAt?: number) => {
      try {
        if (isMovie) {
          await movieStatus.handleWatchedConfirm(watchedAt);
        } else {
          const shouldMarkAll = tvStatus.markEntireSeries;
          const seasons = shouldMarkAll ? await fetchAllSeasons() : undefined;
          await tvStatus.handleWatchedConfirm(watchedAt, seasons);
        }
        setCurrentStatus("watched");
      } finally {
        setWatchedDialogDefaultMs(undefined);
      }
    },
    [fetchAllSeasons, isMovie, movieStatus, tvStatus]
  );

  const handleRemove = useCallback(async () => {
    if (removing) return;
    try {
      setRemoving(true);
      if (isMovie) {
        await movieStatus.handleRemove();
      } else {
        await tvStatus.handleRemove();
      }
      setCurrentStatus(null);
      setRemoveDialogOpen(false);
    } finally {
      setRemoving(false);
      setMenuOpen(false);
    }
  }, [isMovie, movieStatus, removing, tvStatus]);

  const watchedDialogChildren = isTv ? (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={tvStatus.markEntireSeries}
        onCheckedChange={value => tvStatus.setMarkEntireSeries(Boolean(value))}
        disabled={tvStatus.updating || filteredSeasons.length === 0}
      />
      <span>Also mark all episodes in this series as watched</span>
    </label>
  ) : null;

  if (!isMovie && !isTv) {
    return null;
  }

  return (
    <div
      className={cn(
        "group relative h-full flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <MediaCardMenu
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        statusLabel={statusLabel}
        statusOptions={statusOptions}
        currentStatus={currentStatus}
        onStatusSelect={handleStatusSelect}
        updating={updating}
        removeDialogOpen={removeDialogOpen}
        onRemoveDialogOpenChange={setRemoveDialogOpen}
        onRemove={handleRemove}
        removing={removing}
        isMovie={isMovie}
      />

      <Link href={itemLink} className="flex h-full flex-col" prefetch={false}>
        <div className="relative">
          <PosterImage
            src={item.poster_path}
            size="w780"
            alt={title}
            className="w-full"
            fallbackType={isMovie ? "movie" : "tv"}
            hoverZoom
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-background/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur",
              isMovie ? "text-blue-600 dark:text-blue-400" : "text-violet-600 dark:text-violet-400"
            )}
          >
            {isMovie ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}{" "}
            {isMovie ? "Movie" : "TV"}
          </span>
          {currentStatus ? (
            <Badge variant={currentStatus} className="absolute left-2 bottom-2 backdrop-blur">
              {statusLabel}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{title}</h3>
          {date && (
            <p className="mt-1 text-xs text-muted-foreground">{new Date(date).getFullYear()}</p>
          )}
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
            {item.overview || "No overview available."}
          </p>
        </div>
      </Link>

      <WatchedDateDialog
        open={watchedDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onConfirm={handleWatchedConfirm}
        defaultValueMs={watchedDialogDefaultMs}
        hideDatePicker={isTv}
        title={isTv ? "Mark as watched" : "Watched date"}
      >
        {watchedDialogChildren}
      </WatchedDateDialog>
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <Skeleton className="aspect-2/3 w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
