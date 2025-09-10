import { TMDBSearchResult, WatchStatus } from "@/lib/tmdb/types";
import Link from "next/link";
import { PosterImage } from "./tmdb-image";
import { Film, Tv } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";

interface MediaCardProps {
  item: TMDBSearchResult;
  status?: WatchStatus | null;
  className?: string;
}

export function MediaCard({ item, status, className }: MediaCardProps) {
  const isMovie = (item.media_type ?? (item.title ? "movie" : "tv")) === "movie";
  const title = item.title || item.name || "Untitled";
  const date = item.release_date || item.first_air_date;

  const getItemLink = (item: TMDBSearchResult) => {
    const type = item.media_type || (item.title ? "movie" : "tv");
    return type === "movie" ? `/movies/${item.id}` : `/tv-series/${item.id}`;
  };
  return (
    <Link href={getItemLink(item)}>
      <div
        className={cn(
          "group relative h-full flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm hover:cursor-pointer",
          className
        )}
      >
        <div className="relative">
          <PosterImage
            src={item.poster_path}
            size="w780"
            alt={title}
            className="w-full"
            fallbackType={isMovie ? "movie" : "tv"}
            hoverZoom
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur",
              isMovie ? "text-blue-600 dark:text-blue-400" : "text-violet-600 dark:text-violet-400"
            )}
          >
            {isMovie ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}{" "}
            {isMovie ? "Movie" : "TV"}
          </span>
          {status && (
            <span className="absolute left-2 bottom-2 rounded-md bg-primary/80 px-2 py-1 text-[10px] font-medium text-primary-foreground backdrop-blur">
              {WATCH_STATUSES.find(s => s.value === status)?.label || status}
            </span>
          )}
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
      </div>
    </Link>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
