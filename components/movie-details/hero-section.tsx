"use client";

import { type WatchStatus, type Genre } from "@/lib/tmdb/types";
import { Badge } from "@/components/ui/badge";
import { StatusSelector } from "@/components/media/status-selector";
import { BackdropImage, PosterImage } from "@/components/media/tmdb-image";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface MovieHeroSectionProps {
  title: string;
  tagline?: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: Genre[];
  releaseDate: string;
  runtime: number | null;
  originalLanguage: string;
  currentStatus?: WatchStatus | null;
  watchedDate?: number | null;
  onStatusChange: (status: string, watchedAt?: number) => void;
  onRemove: () => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

export function MovieHeroSection({
  title,
  tagline,
  overview,
  posterPath,
  backdropPath,
  genres,
  releaseDate,
  runtime,
  originalLanguage,
  currentStatus,
  watchedDate,
  onStatusChange,
  onRemove,
  isUpdating = false,
  className,
}: MovieHeroSectionProps) {
  const year = releaseDate?.split("-")[0];
  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const hours = runtime ? Math.floor(runtime / 60) : 0;
  const minutes = runtime ? runtime % 60 : 0;
  const runtimeText = runtime ? `${hours > 0 ? `${hours}h ` : ""}${minutes}m` : null;

  return (
    <section className={cn("relative", className)}>
      {/* Backdrop with enhanced cinematic effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <BackdropImage
          src={backdropPath}
          alt={title}
          size="w1280"
          gradient="bottom"
          priority
          className="min-h-75"
        />
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-background/80 via-transparent to-background/80" />
      </div>

      <div className="container px-4 pt-28 pb-10 sm:pt-72">
        <div className="flex flex-col gap-8 sm:flex-row sm:gap-10 animate-fade-up">
          {/* Poster with enhanced styling */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="w-48 sm:w-72 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10 hover:scale-[1.02] transition-transform duration-500">
              <PosterImage src={posterPath} alt={title} size="w500" fallbackType="movie" priority />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left space-y-5">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tighter text-shadow">
                {title}{" "}
                {year && (
                  <span className="text-muted-foreground font-normal opacity-80">({year})</span>
                )}
              </h1>

              {tagline && (
                <p className="mt-3 text-lg sm:text-xl italic text-muted-foreground">{tagline}</p>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
              {genres.map(genre => (
                <Badge key={genre.id} variant="secondary" className="px-3 py-1 text-sm font-medium">
                  {genre.name}
                </Badge>
              ))}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground sm:justify-start font-medium">
              {formattedDate && <span className="flex items-center gap-1.5">{formattedDate}</span>}
              {runtimeText && <span className="flex items-center gap-1.5">• {runtimeText}</span>}
              {originalLanguage && (
                <span className="flex items-center gap-1.5 uppercase">• {originalLanguage}</span>
              )}
            </div>

            {/* Overview */}
            <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto sm:mx-0 text-foreground/90">
              {overview || "No overview available."}
            </p>

            {/* Status Selector */}
            <div className="flex flex-col items-center gap-3 sm:items-start pt-2">
              <StatusSelector
                type="movie"
                currentStatus={currentStatus ?? undefined}
                onChange={onStatusChange}
                onRemove={onRemove}
                disabled={isUpdating}
              />
              {currentStatus === "watched" && watchedDate && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <CalendarCheck className="h-4 w-4" />
                  <span>
                    Watched on{" "}
                    {new Date(watchedDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
