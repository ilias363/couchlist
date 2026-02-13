import Link from "next/link";
import { ChevronRight, CalendarClock, Eye } from "lucide-react";
import { PosterImage } from "@/components/media/tmdb-image";
import { CatchUpItem } from "@/lib/catch-up-types";
import { formatReleaseDate } from "@/lib/tmdb/utils";

export function CatchUpCard({ item }: { item: CatchUpItem }) {
  const progress =
    item.totalEpisodes > 0 ? Math.round((item.watchedEpisodes / item.totalEpisodes) * 100) : 100;

  return (
    <Link
      href={`/tv-series/${item.tvSeriesId}`}
      className="group block glass-card rounded-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Poster */}
        <div className="shrink-0 w-17 sm:w-20 overflow-hidden rounded-lg">
          <PosterImage src={item.posterPath} alt={item.name} size="w185" className="rounded-lg" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-sm sm:text-base tracking-tight group-hover:text-primary transition-colors duration-300 truncate">
                {item.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <TmdbStatusBadge status={item.tmdbStatus} />
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 shrink-0 mt-1" />
          </div>

          {/* Progress bar */}
          {item.totalEpisodes > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>
                  {item.watchedEpisodes}/{item.totalEpisodes} episodes
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/80 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress}%`,
                    background:
                      progress === 100
                        ? "var(--primary)"
                        : `linear-gradient(90deg, var(--primary) 0%, oklch(0.75 0.18 80) 100%)`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Season badges */}
          {(item.unwatchedSeasons.length > 0 || item.upcomingSeasons.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {item.unwatchedSeasons.map(season => (
                <span
                  key={`uw-${season.seasonNumber}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 max-w-full"
                >
                  <Eye className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    S{season.seasonNumber}: {season.episodeCount - season.watchedCount} new episodes
                  </span>
                </span>
              ))}
              {item.upcomingSeasons.map(season => (
                <span
                  key={`up-${season.seasonNumber}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/15 max-w-full"
                >
                  <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    S{season.seasonNumber}
                    {season.airDate && (
                      <span className="opacity-70"> · {formatReleaseDate(season.airDate)}</span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function TmdbStatusBadge({ status }: { status: string }) {
  const styles =
    status === "Returning Series"
      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
      : status === "Ended"
        ? "bg-base-400/10 text-base-500 dark:text-base-400 border-base-400/20"
        : status === "Canceled"
          ? "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20"
          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles}`}>
      {status}
    </span>
  );
}
