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
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || "Failed to load movie");
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
        await setStatus({ movieId: numericId, status: status as any });
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
      {movie && movie.backdrop_path && (
        <div className="relative h-48 w-full rounded-t-sm md:h-72 lg:h-80 overflow-hidden">
          <div className="absolute inset-0">
            <BackdropImage
              src={movie.backdrop_path}
              size="w1280"
              alt={movie.title}
              className="opacity-60 md:opacity-70"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        </div>
      )}

      <div className="relative -mt-12 md:-mt-16 lg:-mt-24 px-4 md:px-8">
        {loading && <MovieSkeleton />}
        {error && !loading && <div className="text-center text-sm text-destructive">{error}</div>}
        {!loading && movie && (
          <div className="space-y-10">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="w-40 sm:w-48 md:w-60 shrink-0 mx-auto md:mx-0 rounded-lg shadow-lg ring-1 ring-border overflow-hidden">
                <PosterImage
                  src={movie.poster_path}
                  size="w780"
                  alt={movie.title}
                  className="rounded-lg"
                  fallbackType="movie"
                  hoverZoom
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl md:text-4xl font-bold leading-tight flex items-center gap-2 flex-wrap">
                    <Film className="h-7 w-7 md:mt-2" />
                    <span>{movie.title}</span>
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
      <div className="w-full md:w-1/3 max-w-xs mx-auto md:mx-0">
        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
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
