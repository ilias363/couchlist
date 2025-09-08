"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { TMDBMovie } from "@/lib/tmdb/types";
import { BackdropImage, PosterImage } from "@/components/tmdb-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusSelector } from "@/components/status-selector";
import { MovieMetaCards } from "@/components/movie/movie-meta-cards";
import { Film } from "lucide-react";

export default function MovieDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const numericId = Number(tmdbId);
  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const userMovie = useQuery(api.movie.getMovieStatus, numericId ? { movieId: numericId } : "skip");
  const setStatus = useMutation(api.movie.setMovieStatus);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!numericId) return;
      setLoading(true);
      setError(null);
      try {
        const m = await tmdbClient.getMovieDetails(numericId);
        if (cancelled) return;
        setMovie(m);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load movie");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  const currentStatus = userMovie?.status;

  const onChangeStatus = useCallback(
    async (status: string) => {
      if (!numericId) return;
      if (status === currentStatus) return;
      try {
        setUpdating(true);
        await setStatus({
          movieId: numericId,
          status: status as "want_to_watch" | "watched" | "on_hold" | "dropped",
        });
      } finally {
        setUpdating(false);
      }
    },
    [numericId, currentStatus, setStatus]
  );

  const genres = movie?.genres?.map(g => g.name).join(" • ");
  const releaseYear = movie?.release_date ? new Date(movie.release_date).getFullYear() : undefined;

  return (
    <div className="mx-auto">
      <div className="relative h-40 w-full md:h-60 lg:h-72 overflow-hidden">
        <BackdropImage src={movie?.backdrop_path} size="w1280" alt={movie?.title ?? ""} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
      </div>

      <div className="relative -mt-10 md:-mt-16 lg:-mt-20 px-4 md:px-8 space-y-4">
        {loading && <MovieSkeleton />}
        {error && !loading && <div className="text-center text-sm text-destructive">{error}</div>}
        {!loading && movie && (
          <div className="space-y-10">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="w-40 sm:w-48 md:w-56 h-fit shrink-0 mx-auto md:mx-0 rounded-lg shadow-lg ring-1 ring-border overflow-hidden">
                <PosterImage
                  src={movie.poster_path}
                  size="w780"
                  alt={movie.title}
                  fallbackType="movie"
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-4xl font-bold leading-tight flex items-center gap-2 flex-wrap">
                    <Film className="h-7 w-7 md:mt-2" />
                    {movie.title}
                    {releaseYear && (
                      <span className="text-primary/70 text-xl md:text-3xl font-medium">
                        ({releaseYear})
                      </span>
                    )}
                  </h1>
                  {movie.tagline && (
                    <p className="italic text-sm md:text-base text-muted-foreground">
                      {movie.tagline}
                    </p>
                  )}
                  {genres && <p className="text-xs md:text-sm text-muted-foreground">{genres}</p>}
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold tracking-wide uppercase">Overview</h2>
                  <p className="text-sm md:text-base leading-relaxed max-w-prose">
                    {movie.overview || "No overview available."}
                  </p>
                </div>
                <StatusSelector
                  type="movie"
                  currentStatus={currentStatus}
                  onChange={onChangeStatus}
                  disabled={updating}
                />
              </div>
            </div>

            <MovieMetaCards movie={movie} />
          </div>
        )}
      </div>
    </div>
  );
}

function MovieSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="w-40 sm:w-48 md:w-56 mx-auto md:mx-0">
        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>
    </div>
  );
}
