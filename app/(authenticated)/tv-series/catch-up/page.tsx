"use client";

import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCatchUpData } from "@/hooks/use-catch-up-data";
import { CatchUpStats } from "@/components/catch-up/catch-up-stats";
import { CatchUpCard } from "@/components/catch-up/catch-up-card";

export default function CatchUpPage() {
  const {
    catchUpItems,
    isLoading,
    totalUpToDate,
    totalNeedingAttention,
    totalUnwatchedEpisodes,
    totalUpcoming,
  } = useCatchUpData();

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/tv-series">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl tracking-tighter">Catch Up</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              New &amp; unwatched episodes from your &ldquo;Up to Date&rdquo; shows
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <CatchUpStats
        totalUpToDate={totalUpToDate}
        totalNeedingAttention={totalNeedingAttention}
        totalUnwatchedEpisodes={totalUnwatchedEpisodes}
        totalUpcoming={totalUpcoming}
        isLoading={isLoading}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : catchUpItems.length === 0 ? (
        <div
          className="animate-fade-up text-center py-20 space-y-4"
          style={{ animationDelay: "160ms" }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 mb-2">
            <Sparkles className="h-9 w-9 text-green-500" />
          </div>
          <h3 className="text-xl font-display tracking-tight">You&apos;re all caught up!</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            All your &ldquo;Up to Date&rdquo; shows are fully watched. Check back later for new
            episodes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {catchUpItems.map((item, i) => (
            <div
              key={item.tvSeriesId}
              className="animate-fade-up"
              style={{ animationDelay: `${160 + i * 60}ms` }}
            >
              <CatchUpCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
