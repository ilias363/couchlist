"use client";

import {
  memo,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TMDBSearchResult, type StatusOption, WatchStatus } from "@/lib/tmdb/types";
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
import {
  prefetchTMDBExtendedMedia,
  useTMDBMovie,
  useTMDBTvSeries,
} from "@/lib/tmdb/react-query";
import { MediaCardMenu } from "./media-card-menu";

interface MediaCardProps {
  item: TMDBSearchResult;
  status?: WatchStatus | null;
  className?: string;
}

type MovieCardItem = Extract<TMDBSearchResult, { media_type: "movie" }>;
type TvCardItem = Extract<TMDBSearchResult, { media_type: "tv" }>;
type SupportedMediaCardItem = MovieCardItem | TvCardItem;

const CARD_PERF_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "320px 500px",
};

function getItemLink(id: number, mediaType: "movie" | "tv") {
  return mediaType === "movie" ? `/movies/${id}` : `/tv-series/${id}`;
}

function useCardPrefetch(id: number, mediaType: "movie" | "tv") {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const href = getItemLink(id, mediaType);

  useEffect(() => {
    prefetchedRef.current = false;
  }, [href, id, mediaType]);

  return () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(href);
    void prefetchTMDBExtendedMedia(queryClient, mediaType, id);
  };
}

interface MediaCardLayoutProps {
  item: SupportedMediaCardItem;
  currentStatus: WatchStatus | null;
  statusLabel?: string;
  statusOptions: StatusOption[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onStatusSelect: (status: WatchStatus) => void;
  updating: boolean;
  removeDialogOpen: boolean;
  onRemoveDialogOpenChange: (open: boolean) => void;
  onRemove: () => Promise<void>;
  removing: boolean;
  watchedDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onWatchedConfirm: (watchedAt?: number) => void | Promise<void>;
  watchedDialogDefaultMs?: number;
  watchedDialogChildren?: ReactNode;
  onLinkIntent: () => void;
  className?: string;
}

function MediaCardLayout({
  item,
  currentStatus,
  statusLabel,
  statusOptions,
  menuOpen,
  onMenuOpenChange,
  onStatusSelect,
  updating,
  removeDialogOpen,
  onRemoveDialogOpenChange,
  onRemove,
  removing,
  watchedDialogOpen,
  onDialogOpenChange,
  onWatchedConfirm,
  watchedDialogDefaultMs,
  watchedDialogChildren,
  onLinkIntent,
  className,
}: MediaCardLayoutProps) {
  const isMovie = item.media_type === "movie";
  const title = isMovie ? item.title : item.name;
  const date = isMovie ? item.release_date : item.first_air_date;
  const itemLink = getItemLink(item.id, item.media_type);

  return (
    <div
      className={cn(
        "group relative h-full flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-500",
        className,
      )}
      style={CARD_PERF_STYLE}
    >
      <MediaCardMenu
        menuOpen={menuOpen}
        onMenuOpenChange={onMenuOpenChange}
        statusLabel={statusLabel}
        statusOptions={statusOptions}
        currentStatus={currentStatus}
        onStatusSelect={onStatusSelect}
        updating={updating}
        removeDialogOpen={removeDialogOpen}
        onRemoveDialogOpenChange={onRemoveDialogOpenChange}
        onRemove={onRemove}
        removing={removing}
        isMovie={isMovie}
      />

      <Link
        href={itemLink}
        className="flex h-full flex-col"
        prefetch={false}
        onMouseEnter={onLinkIntent}
        onFocus={onLinkIntent}
      >
        <div className="relative overflow-hidden">
          <PosterImage
            src={item.poster_path}
            size="w780"
            alt={title ?? ""}
            className="w-full transition-transform duration-500 group-hover:scale-105"
            fallbackType={isMovie ? "movie" : "tv"}
            hoverZoom
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-xl shadow-sm",
              isMovie ? "text-primary" : "text-primary",
            )}
          >
            {isMovie ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}{" "}
            {isMovie ? "Movie" : "TV"}
          </span>
          {currentStatus ? (
            <Badge
              variant={currentStatus}
              className="absolute left-2 bottom-2 backdrop-blur-xl shadow-sm"
            >
              {statusLabel}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          {date && (
            <p className="mt-1.5 text-xs text-muted-foreground font-medium">
              {new Date(date).getFullYear()}
            </p>
          )}
          <p className="mt-2.5 line-clamp-3 text-xs text-muted-foreground leading-relaxed">
            {item.overview || "No overview available."}
          </p>
        </div>
      </Link>

      <WatchedDateDialog
        open={watchedDialogOpen}
        onOpenChange={onDialogOpenChange}
        onConfirm={onWatchedConfirm}
        defaultValueMs={watchedDialogDefaultMs}
        hideDatePicker={!isMovie}
        title={isMovie ? "Watched date" : "Mark as watched"}
      >
        {watchedDialogChildren ?? null}
      </WatchedDateDialog>
    </div>
  );
}

interface MovieMediaCardProps {
  item: MovieCardItem;
  status?: WatchStatus | null;
  className?: string;
}

function MovieMediaCard({ item, status, className }: MovieMediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus | null>(status ?? null);
  const [watchedDialogDefaultMs, setWatchedDialogDefaultMs] = useState<number | undefined>();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setCurrentStatus(status ?? null);
  }, [status]);

  const { data: movieDetails } = useTMDBMovie(item.id, { enabled: menuOpen });
  const {
    updating,
    watchedDialogOpen,
    setWatchedDialogOpen,
    handleStatusChange,
    handleStatusClick,
    handleWatchedConfirm,
    handleRemove,
  } = useMovieStatus(item.id, movieDetails?.runtime);

  const onLinkIntent = useCardPrefetch(item.id, "movie");
  const statusLabel = currentStatus
    ? MOVIE_STATUSES.find(s => s.value === currentStatus)?.label
    : undefined;

  const onDialogOpenChange = (open: boolean) => {
    setWatchedDialogOpen(open);
    if (!open) {
      setWatchedDialogDefaultMs(undefined);
    }
  };

  const onStatusSelect = async (nextStatus: WatchStatus) => {
    if (nextStatus === currentStatus) {
      setMenuOpen(false);
      return;
    }

    if (nextStatus === "watched") {
      setWatchedDialogDefaultMs(Date.now());
      handleStatusClick(nextStatus);
      setMenuOpen(false);
      return;
    }

    try {
      await handleStatusChange(nextStatus);
      setCurrentStatus(nextStatus);
    } finally {
      setMenuOpen(false);
    }
  };

  const onWatchedConfirm = async (watchedAt?: number) => {
    try {
      await handleWatchedConfirm(watchedAt);
      setCurrentStatus("watched");
    } finally {
      setWatchedDialogDefaultMs(undefined);
    }
  };

  const onRemove = async () => {
    if (removing) return;
    try {
      setRemoving(true);
      await handleRemove();
      setCurrentStatus(null);
      setRemoveDialogOpen(false);
    } finally {
      setRemoving(false);
      setMenuOpen(false);
    }
  };

  return (
    <MediaCardLayout
      item={item}
      currentStatus={currentStatus}
      statusLabel={statusLabel}
      statusOptions={MOVIE_STATUSES}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onStatusSelect={onStatusSelect}
      updating={updating}
      removeDialogOpen={removeDialogOpen}
      onRemoveDialogOpenChange={setRemoveDialogOpen}
      onRemove={onRemove}
      removing={removing}
      watchedDialogOpen={watchedDialogOpen}
      onDialogOpenChange={onDialogOpenChange}
      onWatchedConfirm={onWatchedConfirm}
      watchedDialogDefaultMs={watchedDialogDefaultMs}
      onLinkIntent={onLinkIntent}
      className={className}
    />
  );
}

interface TvMediaCardProps {
  item: TvCardItem;
  status?: WatchStatus | null;
  className?: string;
}

function TvMediaCard({ item, status, className }: TvMediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus | null>(status ?? null);
  const [watchedDialogDefaultMs, setWatchedDialogDefaultMs] = useState<number | undefined>();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setCurrentStatus(status ?? null);
  }, [status]);

  const { data: tvDetails } = useTMDBTvSeries(item.id, { enabled: menuOpen });
  const {
    updating,
    watchedDialogOpen,
    setWatchedDialogOpen,
    markEntireSeries,
    setMarkEntireSeries,
    handleStatusChange,
    handleStatusClick,
    handleWatchedConfirm,
    handleRemove,
  } = useTvSeriesStatus(item.id);

  const { filteredSeasons, fetchAllSeasons } = useSeasonData(item.id, tvDetails?.seasons);
  const onLinkIntent = useCardPrefetch(item.id, "tv");
  const statusLabel = currentStatus
    ? WATCH_STATUSES.find(s => s.value === currentStatus)?.label
    : undefined;

  const onDialogOpenChange = (open: boolean) => {
    setWatchedDialogOpen(open);
    if (!open) {
      setWatchedDialogDefaultMs(undefined);
    }
  };

  const onStatusSelect = async (nextStatus: WatchStatus) => {
    if (nextStatus === currentStatus) {
      setMenuOpen(false);
      return;
    }

    if (nextStatus === "watched") {
      setWatchedDialogDefaultMs(Date.now());
      handleStatusClick(nextStatus);
      setMenuOpen(false);
      return;
    }

    try {
      await handleStatusChange(nextStatus);
      setCurrentStatus(nextStatus);
    } finally {
      setMenuOpen(false);
    }
  };

  const onWatchedConfirm = async (watchedAt?: number) => {
    try {
      const seasons = markEntireSeries ? await fetchAllSeasons() : undefined;
      await handleWatchedConfirm(watchedAt, seasons);
      setCurrentStatus("watched");
    } finally {
      setWatchedDialogDefaultMs(undefined);
    }
  };

  const onRemove = async () => {
    if (removing) return;
    try {
      setRemoving(true);
      await handleRemove();
      setCurrentStatus(null);
      setRemoveDialogOpen(false);
    } finally {
      setRemoving(false);
      setMenuOpen(false);
    }
  };

  const watchedDialogChildren = (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={markEntireSeries}
        onCheckedChange={value => setMarkEntireSeries(Boolean(value))}
        disabled={updating || filteredSeasons.length === 0}
      />
      <span>Also mark all episodes in this series as watched</span>
    </label>
  );

  return (
    <MediaCardLayout
      item={item}
      currentStatus={currentStatus}
      statusLabel={statusLabel}
      statusOptions={WATCH_STATUSES}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onStatusSelect={onStatusSelect}
      updating={updating}
      removeDialogOpen={removeDialogOpen}
      onRemoveDialogOpenChange={setRemoveDialogOpen}
      onRemove={onRemove}
      removing={removing}
      watchedDialogOpen={watchedDialogOpen}
      onDialogOpenChange={onDialogOpenChange}
      onWatchedConfirm={onWatchedConfirm}
      watchedDialogDefaultMs={watchedDialogDefaultMs}
      watchedDialogChildren={watchedDialogChildren}
      onLinkIntent={onLinkIntent}
      className={className}
    />
  );
}

function getComparablePoster(item: TMDBSearchResult) {
  return "poster_path" in item ? item.poster_path : undefined;
}

function getComparableOverview(item: TMDBSearchResult) {
  return "overview" in item ? item.overview : undefined;
}

function getComparableTitle(item: TMDBSearchResult) {
  if (item.media_type === "movie") return item.title;
  if (item.media_type === "tv") return item.name;
  return undefined;
}

function getComparableDate(item: TMDBSearchResult) {
  if (item.media_type === "movie") return item.release_date;
  if (item.media_type === "tv") return item.first_air_date;
  return undefined;
}

function areMediaCardPropsEqual(prev: MediaCardProps, next: MediaCardProps) {
  return (
    prev.className === next.className &&
    prev.status === next.status &&
    prev.item.id === next.item.id &&
    prev.item.media_type === next.item.media_type &&
    getComparablePoster(prev.item) === getComparablePoster(next.item) &&
    getComparableOverview(prev.item) === getComparableOverview(next.item) &&
    getComparableTitle(prev.item) === getComparableTitle(next.item) &&
    getComparableDate(prev.item) === getComparableDate(next.item)
  );
}

export const MediaCard = memo(function MediaCard({ item, status, className }: MediaCardProps) {
  if (item.media_type === "movie") {
    return <MovieMediaCard item={item} status={status} className={className} />;
  }
  if (item.media_type === "tv") {
    return <TvMediaCard item={item} status={status} className={className} />;
  }
  return null;
}, areMediaCardPropsEqual);

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
      <Skeleton className="aspect-2/3 w-full" />
      <div className="p-3.5 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
