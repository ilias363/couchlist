"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { TMDBTvSeries, TMDBSeason } from "@/lib/tmdb/types";
import { BackdropImage, PosterImage } from "@/components/tmdb-image";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tv, ExternalLink, Globe2, Users, Clapperboard, CalendarDays, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusSelector } from "@/components/status-selector";

export default function TvSeriesDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const seriesId = Number(tmdbId);
  const [series, setSeries] = useState<TMDBTvSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const userSeries = useQuery(api.tv.getSeriesStatus, seriesId ? { tvSeriesId: seriesId } : "skip");
  const setSeriesStatus = useMutation((api as any).tv?.setSeriesStatus);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!seriesId) return;
      setLoading(true);
      setError(null);
      try {
        const s = await tmdbClient.getTVSeriesDetails(seriesId);
        if (cancelled) return;
        setSeries(s);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || "Failed to load series");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const currentStatus = userSeries?.status;

  const onChangeStatus = useCallback(
    async (status: string) => {
      if (!seriesId || status === currentStatus) return;
      try {
        setUpdating(true);
        await setSeriesStatus({ tvSeriesId: seriesId, status: status });
      } finally {
        setUpdating(false);
      }
    },
    [seriesId, currentStatus, setSeriesStatus]
  );

  const filteredSeasons = useMemo(
    () => series?.seasons?.filter(s => s.season_number !== 0) || [],
    [series]
  );

  const genres = series?.genres?.map(g => g.name).join(" • ");
  const creators = series?.created_by?.map(c => c.name).join(", ");
  const networks = series?.networks?.map(n => n.name).join(", ");
  const originCountries = series?.origin_country?.join(", ");
  const languages = series?.spoken_languages?.map(l => l.english_name).join(" • ");
  const firstAir = series?.first_air_date ? new Date(series.first_air_date) : undefined;
  const lastAir = series?.last_air_date ? new Date(series.last_air_date) : undefined;

  return (
    <div className="mx-auto">
      {series?.backdrop_path && (
        <div className="relative h-40 w-full md:h-60 lg:h-72 overflow-hidden">
          <BackdropImage src={series.backdrop_path} alt={series.name} size="w1280" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        </div>
      )}
      <div className="relative -mt-10 md:-mt-16 lg:-mt-20 px-4 md:px-8 space-y-4">
        {loading && <TvSeriesSkeleton />}
        {error && !loading && <div className="text-center text-sm text-destructive">{error}</div>}
        {!loading && series && (
          <div className="space-y-10">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="w-40 sm:w-48 md:w-56 shrink-0 mx-auto md:mx-0 rounded-lg shadow-lg ring-1 ring-border overflow-hidden">
                <PosterImage
                  src={series.poster_path}
                  size="w780"
                  alt={series.name}
                  fallbackType="tv"
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-4xl font-bold leading-tight flex items-start gap-2 flex-wrap">
                    <Tv className="h-7 w-7 md:mt-2" /> {series.name}
                  </h1>
                  {series.tagline && (
                    <p className="italic text-sm md:text-base text-muted-foreground">
                      {series.tagline}
                    </p>
                  )}
                  {genres && <p className="text-xs md:text-sm text-muted-foreground">{genres}</p>}
                  <p className="text-xs text-muted-foreground">
                    {series.number_of_seasons} season{series.number_of_seasons === 1 ? "" : "s"} •{" "}
                    {series.number_of_episodes} episodes
                  </p>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold tracking-wide uppercase">Overview</h2>
                  <p className="text-sm md:text-base leading-relaxed max-w-prose">
                    {series.overview || "No overview available."}
                  </p>
                </div>
                <StatusSelector
                  type="tv"
                  currentStatus={currentStatus}
                  onChange={onChangeStatus}
                  disabled={updating}
                />
              </div>
            </div>

            <section className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <InfoCard title="Key Info">
                  <ul className="space-y-1 text-xs">
                    {firstAir && (
                      <li className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> First Air:{" "}
                        {firstAir.toLocaleDateString()}
                      </li>
                    )}
                    {lastAir && (
                      <li className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> Last Air:{" "}
                        {lastAir.toLocaleDateString()}
                      </li>
                    )}
                    <li>
                      <span className="text-muted-foreground">Status:</span> {series.status}
                    </li>
                    <li>
                      <span className="text-muted-foreground">Type:</span> {series.type}
                    </li>
                    <li>
                      <span className="text-muted-foreground">Runtime:</span>{" "}
                      {series.episode_run_time?.[0] ? `${series.episode_run_time[0]} min` : "—"}
                    </li>
                    <li>
                      <span className="text-muted-foreground">Origin:</span>{" "}
                      {originCountries || "—"}
                    </li>
                    <li>
                      <span className="text-muted-foreground">Languages:</span> {languages || "—"}
                    </li>
                  </ul>
                </InfoCard>
                <InfoCard title="People">
                  <ul className="space-y-1 text-xs">
                    <li className="flex gap-1">
                      <Users className="h-3 w-3" /> Creators: {creators || "—"}
                    </li>
                    <li className="flex gap-1">
                      <Clapperboard className="h-3 w-3" /> Networks: {networks || "—"}
                    </li>
                  </ul>
                </InfoCard>
                <InfoCard title="Stats">
                  <ul className="space-y-1 text-xs">
                    <li className="flex gap-1">
                      <Star className="h-3 w-3" /> Rating:{" "}
                      {typeof series.vote_average === "number"
                        ? series.vote_average.toFixed(1)
                        : "N/A"}{" "}
                      / 10
                    </li>
                    <li>
                      <span className="text-muted-foreground">Votes:</span>{" "}
                      {series.vote_count?.toLocaleString?.() || "—"}
                    </li>
                    <li>
                      <span className="text-muted-foreground">Popularity:</span>{" "}
                      {series.popularity ? Math.round(series.popularity) : "—"}
                    </li>
                  </ul>
                </InfoCard>
                <InfoCard title="External" className="md:col-span-3">
                  <div className="flex flex-wrap gap-3 text-xs items-center">
                    {series.homepage && (
                      <Link
                        href={series.homepage}
                        target="_blank"
                        className="underline text-primary"
                        rel="noopener noreferrer"
                      >
                        Homepage
                      </Link>
                    )}
                  </div>
                </InfoCard>
              </div>

              <div className="space-y-4">
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
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
function TvSeriesSkeleton() {
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
