"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTMDBExtendedTvSeries } from "@/lib/tmdb/react-query";
import { MediaCarousel } from "@/components/media/media-carousel";
import { useTvSeriesStatus } from "@/hooks/use-tv-status";
import { useSeasonData } from "@/hooks/use-season-data";
import { TvHeroSection } from "@/components/tv-details/hero-section";
import { TvDetailsGrid } from "@/components/tv-details/details-grid";
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
    return <TvSeriesPageSkeleton />;
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
        currentStatus={currentStatus}
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

        <SeasonsSection seriesId={series.id} seasons={series.seasons} />

        {series.recommendations.results.length > 0 && (
          <MediaCarousel
            title="Recommended"
            items={series.recommendations.results.map(it => {
              return { ...it, media_type: "tv" };
            })}
          />
        )}

        {series.similar.results.length > 0 && (
          <MediaCarousel
            title="Similar series"
            items={series.similar.results.map(it => {
              return { ...it, media_type: "tv" };
            })}
          />
        )}
      </div>
    </div>
  );
}

function TvSeriesPageSkeleton() {
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
