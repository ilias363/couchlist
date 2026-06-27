"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTMDBExtendedTvSeries } from "@/lib/tmdb/react-query";
import { MediaCarousel } from "@/components/media/media-carousel";
import { useTvSeriesStatus } from "@/hooks/use-tv-status";
import { useSeasonData } from "@/hooks/use-season-data";
import { TvHeroSection } from "@/components/tv-details/hero-section";
import { TvDetailsGrid } from "@/components/tv-details/details-grid";
import { CastSection } from "@/components/details-shared/cast-section";
import { DetailPageSkeleton } from "@/components/details-shared/detail-skeleton";
import { SeasonsSection } from "@/components/tv-details/seasons-section";

export default function TvSeriesDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const seriesId = Number(tmdbId);

  const { data: series, isLoading: loading, error } = useTMDBExtendedTvSeries(seriesId);
  const { filteredSeasons, fetchAllSeasons } = useSeasonData(seriesId, series?.seasons);

  const userSeries = useQuery(api.tv.getSeriesStatus, seriesId ? { tvSeriesId: seriesId } : "skip");
  const tvStatus = useTvSeriesStatus(seriesId);

  const currentStatus = userSeries?.status;

  const onChangeStatus = async (status: string, watchedAt?: number) => {
    if (!seriesId || status === currentStatus) return;
    const seasons = await fetchAllSeasons();
    await tvStatus.handleStatusChange(status, watchedAt, seasons);
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error) {
    return (
      <div className="px-4 md:px-8 py-6">
        <div className="text-center text-sm text-destructive">{error.message}</div>
      </div>
    );
  }

  if (!series) {
    return null;
  }

  return (
    <div className="mx-auto">
      <TvHeroSection
        name={series.name}
        tagline={series.tagline}
        overview={series.overview}
        posterPath={series.poster_path}
        backdropPath={series.backdrop_path}
        genres={series.genres}
        firstAirDate={series.first_air_date}
        originalLanguage={series.original_language}
        voteAverage={series.vote_average}
        voteCount={series.vote_count}
        currentStatus={currentStatus}
        startedAt={userSeries?.startedAt}
        lastWatchedAt={userSeries?.lastWatchedAt}
        onStatusChange={onChangeStatus}
        onRemove={tvStatus.handleRemove}
        isUpdating={tvStatus.updating}
        markEntireSeries={tvStatus.markEntireSeries}
        onMarkEntireSeriesChange={tvStatus.setMarkEntireSeries}
        hasSeasons={filteredSeasons.length > 0}
      />

      <div className="mt-4 space-y-4 md:mt-8 md:space-y-8">
        <TvDetailsGrid
          firstAirDate={series.first_air_date}
          status={series.status}
          numberOfSeasons={series.number_of_seasons}
          numberOfEpisodes={series.number_of_episodes}
          voteAverage={series.vote_average}
          voteCount={series.vote_count}
          productionCompanies={series.production_companies}
          productionCountries={series.production_countries}
          spokenLanguages={series.spoken_languages}
          networks={series.networks}
          seriesId={series.id}
          externalIds={series.external_ids}
          homepage={series.homepage}
        />

        <CastSection cast={series.credits?.cast} />

        <SeasonsSection seriesId={series.id} seasons={series.seasons} />

        {series.recommendations.results.length > 0 ? (
          <MediaCarousel
            title="Recommended"
            items={series.recommendations.results.map(it => ({ ...it, media_type: "tv" as const }))}
          />
        ) : null}

        {series.similar.results.length > 0 ? (
          <MediaCarousel
            title="Similar series"
            items={series.similar.results.map(it => ({ ...it, media_type: "tv" as const }))}
          />
        ) : null}
      </div>
    </div>
  );
}
