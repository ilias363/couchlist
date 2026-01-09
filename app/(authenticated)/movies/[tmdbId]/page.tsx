"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTMDBExtendedMovie } from "@/lib/tmdb/react-query";
import { useMovieStatus } from "@/hooks/use-movie-status";
import { MovieHeroSection } from "@/components/movie-details/hero-section";
import { MovieDetailsGrid } from "@/components/movie-details/details-grid";
import { MediaCarousel } from "@/components/media/media-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { WatchStatus } from "@/lib/tmdb/types";

export default function MovieDetailsPage() {
  const params = useParams();
  const tmdbId = Number(params.tmdbId);

  // Fetch movie data
  const { data: movie, isLoading, isError } = useTMDBExtendedMovie(tmdbId);

  // Fetch user status
  const movieStatus = useQuery(api.movie.getMovieStatus, { movieId: tmdbId });

  // Status management hook
  const { handleStatusChange, handleRemove, updating } = useMovieStatus(
    tmdbId,
    movie?.runtime || null
  );

  if (isLoading) {
    return MoviePageSkeleton();
  }

  if (isError || !movie) {
    return (
      <div className="text-center py-12 text-muted-foreground">Failed to load movie details.</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <MovieHeroSection
        title={movie.title}
        tagline={movie.tagline}
        overview={movie.overview}
        posterPath={movie.poster_path}
        backdropPath={movie.backdrop_path}
        genres={movie.genres}
        releaseDate={movie.release_date}
        runtime={movie.runtime}
        originalLanguage={movie.original_language}
        currentStatus={movieStatus?.status as WatchStatus | null}
        watchedDate={movieStatus?.watchedDate}
        onStatusChange={handleStatusChange}
        onRemove={handleRemove}
        isUpdating={updating}
      />

      {/* Details Grid */}
      <MovieDetailsGrid
        releaseDate={movie.release_date}
        status={movie.status}
        runtime={movie.runtime}
        voteAverage={movie.vote_average}
        voteCount={movie.vote_count}
        budget={movie.budget}
        revenue={movie.revenue}
        productionCompanies={movie.production_companies}
        productionCountries={movie.production_countries}
        spokenLanguages={movie.spoken_languages}
        movieId={movie.id}
        externalIds={movie.external_ids}
        homepage={movie.homepage}
      />

      {/* Recommendations */}
      {movie.recommendations.results.length > 0 && (
        <MediaCarousel
          title="Recommended"
          items={movie.recommendations.results.map(it => {
            return { ...it, media_type: "movie" as const };
          })}
        />
      )}

      {/* Similar Movies */}
      {movie.similar.results.length > 0 && (
        <MediaCarousel
          title="Similar movies"
          items={movie.similar.results.map(it => {
            return { ...it, media_type: "movie" as const };
          })}
        />
      )}
    </div>
  );
}

function MoviePageSkeleton() {
  return (
    <div className="mx-auto">
      <div className="relative w-full overflow-hidden">
        <Skeleton className="aspect-[16/12] sm:aspect-[16/7] w-full" />
        <div className="relative -mt-20 md:absolute md:inset-x-0 md:bottom-0">
          <div className="px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:translate-y-4">
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
          </div>
        </div>
      </div>
      <div className="px-4 md:px-8 mt-4 md:mt-10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
