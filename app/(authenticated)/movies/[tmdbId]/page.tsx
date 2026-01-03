"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTMDBExtendedMovie } from "@/lib/tmdb/react-query";
import { useMovieStatus } from "@/hooks/use-movie-status";
import { MovieHeroSection } from "@/components/movie-details/hero-section";
import { MovieDetailsGrid } from "@/components/movie-details/details-grid";
import { MediaCarousel } from "@/components/media-carousel";
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
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <Skeleton className="w-48 sm:w-64 aspect-[2/3] rounded-xl mx-auto sm:mx-0" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
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
