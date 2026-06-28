"use client";

import Link from "next/link";
import Image from "next/image";
import { Info, Play, Search, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getTMDBImgUrl, formatRuntime, WATCH_STATUSES } from "@/lib/tmdb/utils";
import { useHomeHero, type HeroFeature } from "@/hooks/use-home-hero";

function HeroShell({
  backdropPath,
  title,
  children,
}: {
  backdropPath: string | null;
  title: string;
  children: React.ReactNode;
}) {
  const backdropUrl = getTMDBImgUrl(backdropPath, "w1280");

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/50 shadow-xl shadow-black/5">
      <div className="absolute inset-0 -z-10">
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-primary/20 via-card to-background" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-card via-card/45 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-card/80 via-card/15 to-transparent" />
      </div>

      <div className="relative flex min-h-88 max-w-2xl flex-col justify-end gap-4 p-6 sm:min-h-104 sm:p-10">
        {children}
      </div>
    </section>
  );
}

function FeatureHero({ feature }: { feature: HeroFeature }) {
  const eyebrow =
    feature.source === "continue"
      ? "Continue watching"
      : feature.source === "watchlist"
        ? "From your watchlist"
        : "Trending now";

  const statusLabel = feature.status
    ? WATCH_STATUSES.find(s => s.value === feature.status)?.label
    : undefined;

  const rating =
    feature.voteAverage > 0 ? feature.voteAverage.toFixed(1) : null;
  const runtime = formatRuntime(feature.runtimeMinutes);
  const detailsHref =
    feature.mediaType === "movie"
      ? `/movies/${feature.id}`
      : `/tv-series/${feature.id}`;
  const listHref = feature.mediaType === "movie" ? "/movies" : "/tv-series";
  const primaryLabel =
    feature.source === "continue" ? "Continue" : "View details";
  const PrimaryIcon = feature.source === "continue" ? Play : Info;

  return (
    <HeroShell backdropPath={feature.backdropPath} title={feature.title}>
      <div className="flex flex-wrap items-center gap-2.5 animate-fade-up">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {eyebrow}
        </span>
        {feature.status && statusLabel && (
          <Badge variant={feature.status}>{statusLabel}</Badge>
        )}
      </div>

      <h1
        className="text-3xl font-bold tracking-tighter text-shadow sm:text-5xl animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        {feature.title}
      </h1>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-muted-foreground animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        {feature.year && <span>{feature.year}</span>}
        {rating && (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {rating}
          </span>
        )}
        {runtime && <span>{runtime}</span>}
        {feature.genres.length > 0 && (
          <span className="hidden sm:inline">
            {feature.genres
              .slice(0, 2)
              .map(g => g.name)
              .join(" · ")}
          </span>
        )}
      </div>

      {feature.overview && (
        <p
          className="line-clamp-2 max-w-xl text-sm leading-relaxed text-foreground/80 sm:line-clamp-3 sm:text-base animate-fade-up"
          style={{ animationDelay: "0.15s" }}
        >
          {feature.overview}
        </p>
      )}

      <div
        className="flex flex-wrap items-center gap-3 pt-1 animate-fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        <Link href={detailsHref}>
          <Button size="lg" className="gap-2 rounded-xl font-semibold">
            <PrimaryIcon className="h-4 w-4" />
            {primaryLabel}
          </Button>
        </Link>
        {feature.source !== "trending" && (
          <Link href={listHref}>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5"
            >
              View all
            </Button>
          </Link>
        )}
      </div>
    </HeroShell>
  );
}

function OnboardingHero({ backdropPath }: { backdropPath: string | null }) {
  return (
    <HeroShell backdropPath={backdropPath} title="Welcome to CouchList">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary animate-fade-up">
        <Sparkles className="h-3.5 w-3.5" />
        Welcome to CouchList
      </span>

      <h1
        className="text-3xl font-bold tracking-tighter text-shadow sm:text-5xl animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        Your watchlist <span className="gradient-text">starts here</span>
      </h1>

      <p
        className="max-w-xl text-sm leading-relaxed text-foreground/80 sm:text-base animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        Search thousands of movies and shows, track what you watch, and pick up
        right where you left off — across every device.
      </p>

      <div
        className="flex flex-wrap items-center gap-3 pt-1 animate-fade-up"
        style={{ animationDelay: "0.15s" }}
      >
        <Link href="/search">
          <Button size="lg" className="gap-2 rounded-xl font-semibold">
            <Search className="h-4 w-4" />
            Find something to watch
          </Button>
        </Link>
        <span className="text-sm text-muted-foreground">
          or explore what&apos;s trending below
        </span>
      </div>
    </HeroShell>
  );
}

function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-card">
      <div className="flex min-h-88 max-w-2xl flex-col justify-end gap-4 p-6 sm:min-h-104 sm:p-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-3/4 sm:h-14" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-11 w-36 rounded-xl" />
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
    </section>
  );
}

export function HomeHero() {
  const { mode, feature } = useHomeHero();

  if (mode === "loading") return <HeroSkeleton />;
  if (mode === "onboarding")
    return <OnboardingHero backdropPath={feature?.backdropPath ?? null} />;
  if (feature) return <FeatureHero feature={feature} />;
  return null;
}
