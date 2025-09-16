"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import { BackdropImage, PosterImage, LogoImage } from "@/components/tmdb-image";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Globe, Landmark, Languages, Star, Tv } from "lucide-react";
import { StatusSelector } from "@/components/status-selector";
import { useTMDBExtendedTvSeries } from "@/lib/tmdb/react-query";
import { Badge } from "@/components/ui/badge";
import { InfoCard } from "@/components/info-card";
import { MediaCarousel } from "@/components/media-carousel";
import { formatReleaseDate, getExternalLinks } from "@/lib/tmdb/utils";

export default function TvSeriesDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const seriesId = Number(tmdbId);
  const { data: series, isLoading: loading, error } = useTMDBExtendedTvSeries(seriesId);
  const [updating, setUpdating] = useState(false);

  const userSeries = useQuery(api.tv.getSeriesStatus, seriesId ? { tvSeriesId: seriesId } : "skip");
  const setSeriesStatus = useMutation(api.tv.setSeriesStatus);
  const deleteTvSeries = useMutation(api.tv.deleteTvSeries);

  const currentStatus = userSeries?.status;

  const onChangeStatus = useCallback(
    async (status: string) => {
      if (!seriesId || status === currentStatus) return;
      try {
        setUpdating(true);
        await setSeriesStatus({
          tvSeriesId: seriesId,
          status: status as "want_to_watch" | "watched" | "on_hold" | "dropped",
        });
      } finally {
        setUpdating(false);
      }
    },
    [seriesId, currentStatus, setSeriesStatus]
  );

  const onRemove = useCallback(async () => {
    if (!seriesId) return;
    setUpdating(true);
    try {
      await deleteTvSeries({ tvSeriesId: seriesId });
    } finally {
      setUpdating(false);
    }
  }, [seriesId, deleteTvSeries]);

  const filteredSeasons = useMemo(
    () => series?.seasons?.filter(s => s.season_number !== 0) || [],
    [series]
  );

  const releaseYear = series?.first_air_date
    ? new Date(series.first_air_date).getFullYear()
    : undefined;
  const formattedFirstAir = formatReleaseDate(series?.first_air_date);

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
      <div className="relative w-full overflow-visible md:overflow-hidden">
        <BackdropImage
          src={series.backdrop_path}
          alt={series.name}
          size="w1280"
          gradient="bottom"
        />
        <div className="relative -mt-20 md:absolute md:inset-x-0 md:bottom-0">
          <div className="px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col gap-4 md:gap-6 md:flex-row md:items-center md:translate-y-4">
              <div className="w-40 sm:w-48 md:w-56 h-fit shrink-0 mx-auto md:mx-0 rounded-lg shadow-lg ring-1 ring-border overflow-hidden">
                <PosterImage
                  src={series.poster_path}
                  size="w780"
                  alt={series.name}
                  fallbackType="tv"
                />
              </div>
              <div className="flex-1 space-y-3 md:space-y-4">
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-4xl font-bold leading-tight flex items-center gap-2 flex-wrap">
                    <Tv className="h-7 w-7 md:mt-2" />
                    {series.name}
                    {releaseYear && (
                      <span className="text-primary/70 text-xl md:text-3xl font-medium">
                        ({releaseYear})
                      </span>
                    )}
                  </h1>
                  {series.tagline && (
                    <p className="italic text-sm md:text-base text-muted-foreground">
                      {series.tagline}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {series.genres.map(g => (
                      <Badge key={g.id} variant={"secondary"}>
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formattedFirstAir || "----"}
                    {series.original_language ? ` • ${series.original_language.toUpperCase()}` : ""}
                  </p>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold tracking-wide uppercase">Overview</h2>
                  <p className="text-sm md:text-base leading-relaxed max-w-prose">
                    {series.overview || "No overview available."}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusSelector
                    type="tv"
                    currentStatus={currentStatus}
                    onChange={onChangeStatus}
                    disabled={updating}
                    onRemove={onRemove}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4 md:mt-8 md:space-y-8">
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard title="Facts">
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <span className="font-medium text-foreground">First air date:</span>{" "}
                    {formattedFirstAir || "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Status:</span>{" "}
                    {series.status || "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Seasons / Episodes:</span>{" "}
                    {series.number_of_seasons} / {series.number_of_episodes}
                  </li>
                  <li className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-foreground">Rating:</span>
                    <span className="ml-1">
                      {series.vote_average?.toFixed?.(1) ?? "—"} (
                      {series.vote_count?.toLocaleString?.() ?? 0})
                    </span>
                  </li>
                </ul>
              </InfoCard>

              <InfoCard title="Production">
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                      <Landmark className="h-4 w-4" /> Companies
                    </div>
                    {series.production_companies?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {series.production_companies.map(c => (
                          <Badge key={c.id} variant="outline">
                            {c.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                      <Globe className="h-4 w-4" /> Countries
                    </div>
                    {series.production_countries?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {series.production_countries.map(c => (
                          <Badge key={c.iso_3166_1} variant="secondary">
                            {c.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
              </InfoCard>

              <InfoCard title="Languages">
                {series.spoken_languages?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {series.spoken_languages.map(l => (
                      <Badge
                        key={l.iso_639_1}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <Languages className="h-3 w-3" /> {l.english_name || l.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCard>

              <InfoCard title="Networks">
                {series.networks.length ? (
                  <div className="grid grid-cols-2 items-center">
                    {series.networks.map(n => (
                      <div key={n.id} className="flex items-center gap-2">
                        <LogoImage
                          src={n.logo_path}
                          alt={n.name}
                          size="w154"
                          className="rounded-none"
                        />
                        <span className="text-sm">{n.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCard>

              <InfoCard title="Links">
                <div className="text-sm space-y-2 grid grid-cols-2">
                  {getExternalLinks({
                    externalIds: series.external_ids,
                    homepage: series.homepage,
                    tmdbId: series.id,
                    type: "tv",
                  }).map(l => (
                    <div key={l.key}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {l.label}
                      </a>
                    </div>
                  ))}
                  {getExternalLinks({
                    externalIds: series.external_ids,
                    homepage: series.homepage,
                    tmdbId: series.id,
                    type: "tv",
                  }).length === 0 && (
                    <span className="text-muted-foreground">No external links</span>
                  )}
                </div>
              </InfoCard>
            </div>
          </div>
        </section>

        {filteredSeasons.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Seasons</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSeasons.map(s => (
                <Link
                  key={s.id}
                  href={`/tv-series/${seriesId}/season/${s.season_number}`}
                  className="group rounded-lg border bg-card p-2 shadow-sm hover:ring-2 hover:ring-ring transition"
                >
                  <div className="flex gap-4">
                    <div className="w-16 shrink-0 rounded overflow-hidden">
                      <PosterImage src={s.poster_path} alt={s.name} size="w154" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-sm font-semibold leading-tight group-hover:text-primary">
                        Season {s.season_number}
                      </h3>
                      <p className="text-[10px] text-muted-foreground/70">
                        {s.air_date?.slice(0, 4) || "----"} • {s.episode_count} eps
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {s.overview || "No description."}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

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
        <Skeleton className="aspect-[16/9] w-full" />
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
