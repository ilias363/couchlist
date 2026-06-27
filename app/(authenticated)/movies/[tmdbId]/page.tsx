"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTMDBExtendedMovie } from "@/lib/tmdb/react-query";
import { useMovieStatus } from "@/hooks/use-movie-status";
import { MovieHeroSection } from "@/components/movie-details/hero-section";
import { MovieDetailsGrid } from "@/components/movie-details/details-grid";
import { CastSection } from "@/components/details-shared/cast-section";
import { DetailPageSkeleton } from "@/components/details-shared/detail-skeleton";
import { MediaCarousel } from "@/components/media/media-carousel";
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
    movie?.runtime || null,
  );

  if (isLoading) {
    return <DetailPageSkeleton />;
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
        voteAverage={movie.vote_average}
        voteCount={movie.vote_count}
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

      {/* Cast */}
      <CastSection cast={movie.credits?.cast} />

      {/* Recommendations */}
      {movie.recommendations.results.length > 0 ? (
        <MediaCarousel
          title="Recommended"
          items={movie.recommendations.results.map(it => ({ ...it, media_type: "movie" as const }))}
        />
      ) : null}

      {/* Similar Movies */}
      {movie.similar.results.length > 0 ? (
        <MediaCarousel
          title="Similar movies"
          items={movie.similar.results.map(it => ({ ...it, media_type: "movie" as const }))}
        />
      ) : null}
    </div>
  );
}
