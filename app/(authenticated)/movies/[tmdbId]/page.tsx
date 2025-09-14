"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { BackdropImage, PosterImage } from "@/components/tmdb-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { useTMDBExtendedMovie } from "@/lib/tmdb/react-query";
import { api } from "@/convex/_generated/api";
import { StatusSelector } from "@/components/status-selector";
import { Film, Globe, Landmark, Languages, PiggyBank, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatReleaseDate, formatRuntime, getExternalLinks } from "@/lib/tmdb/utils";
import { MediaCarousel } from "@/components/media-carousel";
import { InfoCard } from "@/components/info-card";

export default function MovieDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const numericId = Number(tmdbId);
  const { data: movie, isLoading: loading, error } = useTMDBExtendedMovie(numericId);
  const [updating, setUpdating] = useState(false);

  const userMovie = useQuery(api.movie.getMovieStatus, numericId ? { movieId: numericId } : "skip");
  const setStatus = useMutation(api.movie.setMovieStatus);

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
          runtime: movie?.runtime ?? undefined,
        });
      } finally {
        setUpdating(false);
      }
    },
    [numericId, currentStatus, setStatus, movie?.runtime]
  );

  const releaseYear = movie?.release_date ? new Date(movie.release_date).getFullYear() : undefined;
  const formattedRelease = formatReleaseDate(movie?.release_date);
  const runtimeText = formatRuntime(movie?.runtime);

  if (loading) {
    return <MoviePageSkeleton />;
  }

  if (error) {
    return (
      <div className="px-4 md:px-8 py-6">
        <div className="text-center text-sm text-destructive">{error.message}</div>
      </div>
    );
  }

  if (!movie) {
    return null;
  }

  return (
    <div className="mx-auto">
      <div className="relative w-full overflow-visible md:overflow-hidden">
        <BackdropImage src={movie.backdrop_path} size="w1280" alt={movie.title} gradient="bottom" />

        <div className="relative -mt-20 md:absolute md:inset-x-0 md:bottom-0">
          <div className="px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col gap-4 md:gap-6 md:flex-row md:items-center md:translate-y-4">
              <div className="w-40 sm:w-48 md:w-56 h-fit shrink-0 mx-auto md:mx-0 rounded-lg shadow-lg ring-1 ring-border overflow-hidden">
                <PosterImage
                  src={movie.poster_path}
                  size="w780"
                  alt={movie.title}
                  fallbackType="movie"
                />
              </div>
              <div className="flex-1 space-y-3 md:space-y-4">
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
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map(g => (
                      <Badge key={g.id} variant={"secondary"}>
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold tracking-wide uppercase">Overview</h2>
                  <p className="text-sm md:text-base leading-relaxed max-w-prose">
                    {movie.overview || "No overview available."}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formattedRelease || "----"}
                  {runtimeText ? ` • ${runtimeText}` : ""}
                  {movie.original_language ? ` • ${movie.original_language.toUpperCase()}` : ""}
                </p>
                <StatusSelector
                  type="movie"
                  currentStatus={currentStatus}
                  onChange={onChangeStatus}
                  disabled={updating}
                />
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
                    <span className="font-medium text-foreground">Release date:</span>{" "}
                    {formattedRelease || "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Status:</span>{" "}
                    {movie.status || "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Runtime:</span>{" "}
                    {runtimeText || "—"}
                  </li>
                  <li className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-foreground">Rating:</span>
                    <span className="ml-1">
                      {movie.vote_average?.toFixed?.(1) ?? "—"} (
                      {movie.vote_count?.toLocaleString?.() ?? 0})
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
                    {movie.production_companies?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {movie.production_companies.map(c => (
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
                    {movie.production_countries?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {movie.production_countries.map(c => (
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
                {movie.spoken_languages?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {movie.spoken_languages.map(l => (
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

              <InfoCard title="Financials" className="lg:col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Budget</div>
                    <div className="text-base font-semibold flex items-center gap-2">
                      <PiggyBank className="h-4 w-4" /> {formatCurrency(movie.budget)}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="text-base font-semibold flex items-center gap-2">
                      <PiggyBank className="h-4 w-4" /> {formatCurrency(movie.revenue)}
                    </div>
                  </div>
                </div>
              </InfoCard>

              <InfoCard title="Links">
                <div className="text-sm space-y-2 grid grid-cols-2">
                  {getExternalLinks({
                    externalIds: movie.external_ids,
                    homepage: movie.homepage,
                    tmdbId: movie.id,
                    type: "movie",
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
                    externalIds: movie.external_ids,
                    homepage: movie.homepage,
                    tmdbId: movie.id,
                    type: "movie",
                  }).length === 0 && (
                    <span className="text-muted-foreground">No external links</span>
                  )}
                </div>
              </InfoCard>
            </div>
          </div>
        </section>

        {movie.recommendations.results.length > 0 && (
          <MediaCarousel
            title="Recommended"
            items={movie.recommendations.results.map(it => {
              return { ...it, media_type: "movie" };
            })}
          />
        )}

        {movie.similar.results.length > 0 && (
          <MediaCarousel
            title="Similar movies"
            items={movie.similar.results.map(it => {
              return { ...it, media_type: "movie" };
            })}
          />
        )}
      </div>
    </div>
  );
}

function MoviePageSkeleton() {
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
