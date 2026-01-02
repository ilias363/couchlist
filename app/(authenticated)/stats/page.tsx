"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DoughnutChart,
  BarChart,
  LineChart,
  statusPalette,
  doughnutOptions,
  weekdayLabel,
  barOptions,
} from "@/components/stats/charts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame,
  BarChart3,
  Clock,
  Film,
  Tv,
  Rows3,
  RefreshCw,
  Trophy,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { useEffect, useState } from "react";
import { UserStats } from "@/lib/types";
import { Section } from "@/components/stats/section";
import { AccentHeader } from "@/components/stats/accent-header";
import { Sparkline } from "@/components/stats/spark-line";
import { StatsCard } from "@/components/stats/stats-card";

export default function StatsPage() {
  const [data, setData] = useState<UserStats | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const getStats = useMutation(api.stats.getUserStats);
  const refreshStats = useMutation(api.stats.refreshStats);

  useEffect(() => {
    getStats().then(setData);
  }, [getStats]);

  if (!data) return <LoadingState />;
  const {
    overview,
    distributions,
    weeklyActivity,
    recentActivity,
    watchTimeBreakdown,
    streaks,
    weekdayDistribution,
    dailyActivity,
    completionRates,
    generatedAt,
  } = data;

  const movieDistColors = statusPalette(distributions.movies.length);
  const tvDistColors = statusPalette(distributions.tvSeries.length);

  const movieDistData = {
    labels: distributions.movies.map(d => d.status),
    datasets: [
      {
        label: "Movies",
        data: distributions.movies.map(d => d.value),
        backgroundColor: movieDistColors,
        borderWidth: 0,
      },
    ],
  };

  const tvDistData = {
    labels: distributions.tvSeries.map(d => d.status),
    datasets: [
      {
        label: "TV Series",
        data: distributions.tvSeries.map(d => d.value),
        backgroundColor: tvDistColors,
        borderWidth: 0,
      },
    ],
  };

  const weeklyLabels = weeklyActivity.map(w => w.label);
  const weeklyChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: "Movies Watched",
        data: weeklyActivity.map(w => w.movies),
        borderColor: "#6366F1",
        backgroundColor: "rgba(99,102,241,0.35)",
        fill: true,
        tension: 0.35,
      },
      {
        label: "Episodes Watched",
        data: weeklyActivity.map(w => w.episodes),
        borderColor: "#0EA5E9",
        backgroundColor: "rgba(14,165,233,0.35)",
        fill: true,
        tension: 0.35,
      },
    ],
  };

  return (
    <div className="space-y-4">
      {/* Page Header with Refresh Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Insights</h1>
            <p className="text-muted-foreground">
              Visual breakdown of your viewing patterns & progress
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date(generatedAt).toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                const newStats = await refreshStats();
                setData(newStats);
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Movies Watched"
          value={overview.totalWatchedMovies}
          description={`${overview.totalStartedMovies} total in library`}
          icon={<Film className="h-5 w-5" />}
        />
        <StatsCard
          title="TV Shows Watched"
          value={overview.totalWatchedTvSeries}
          description={`${overview.totalStartedTvSeries} total in library`}
          icon={<Tv className="h-5 w-5" />}
        />
        <StatsCard
          title="Episodes Watched"
          value={overview.totalWatchedEpisodes}
          description={`${overview.totalWatchedSeasons} seasons completed`}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Watch Time"
          value={`${overview.totalWatchTimeHours}h`}
          description={`${overview.totalWatchTimeMinutes} minutes`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Streaks and Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Current Streak"
          value={`${streaks.current} days`}
          description="Keep it going!"
          icon={<Flame className="h-5 w-5" />}
        />
        <StatsCard
          title="Longest Streak"
          value={`${streaks.longest} days`}
          description="Your personal best"
          icon={<Trophy className="h-5 w-5" />}
        />
        <StatsCard
          title="Last 30 Days"
          value={recentActivity.totalItems}
          description={`${recentActivity.moviesWatched} movies, ${recentActivity.episodesWatched} episodes`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Daily Activity</p>
              <Sparkline data={dailyActivity} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Section title="Weekly Activity" description="Your viewing momentum over the last 12 weeks">
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="relative h-72">
              <LineChart
                data={weeklyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                  plugins: { legend: { display: true } },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Collections" description="Status distribution across your tracked items">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="overflow-hidden">
            <AccentHeader icon={Film} title={"Movies"} subtitle={"Status distribution"} />
            <CardContent className="pt-6">
              <div className="h-56 md:h-72 relative">
                <DoughnutChart data={movieDistData} options={doughnutOptions} />
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <AccentHeader icon={Tv} title={"TV Series"} subtitle={"Status distribution"} />
            <CardContent className="pt-6">
              <div className="h-56 md:h-72 relative">
                <DoughnutChart data={tvDistData} options={doughnutOptions} />
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Viewing Patterns" description="Temporal and time investment breakdowns">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 overflow-hidden">
            <AccentHeader icon={Rows3} title="Weekday Distribution" subtitle="Viewing cadence" />
            <CardContent className="pt-6">
              <div className="relative h-64">
                <BarChart
                  data={{
                    labels: weekdayDistribution.map(w => weekdayLabel(w.weekday)),
                    datasets: [
                      {
                        label: "Movies",
                        data: weekdayDistribution.map(w => w.movies),
                        backgroundColor: "#6366F1",
                        borderRadius: 4,
                      },
                      {
                        label: "Episodes",
                        data: weekdayDistribution.map(w => w.episodes),
                        backgroundColor: "#0EA5E9",
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={barOptions}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <AccentHeader icon={Clock} title="Watch Time" subtitle="Minutes invested" />
            <CardContent className="pt-6 flex flex-col gap-4">
              <div className="h-56 relative">
                <DoughnutChart
                  data={{
                    labels: ["Movies", "Episodes"],
                    datasets: [
                      {
                        data: [
                          watchTimeBreakdown.moviesMinutes,
                          watchTimeBreakdown.episodesMinutes,
                        ],
                        backgroundColor: ["#6366F1", "#0EA5E9"],
                        borderWidth: 0,
                        borderColor: "transparent",
                      },
                    ],
                  }}
                  options={doughnutOptions}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Movies</span>
                  <br />
                  <span className="font-medium">{watchTimeBreakdown.moviesMinutes}m</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Episodes</span>
                  <br />
                  <span className="font-medium">{watchTimeBreakdown.episodesMinutes}m</span>
                </div>
                <div className="col-span-2 text-center text-xs text-muted-foreground">
                  Total {watchTimeBreakdown.totalMinutes} min
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Completion Rates */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Movie Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, completionRates.movies * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-lg font-semibold">
                {Math.round(completionRates.movies * 100)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {overview.totalWatchedMovies} of {overview.totalStartedMovies} started movies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">TV Series Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, completionRates.tvSeries * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-lg font-semibold">
                {Math.round(completionRates.tvSeries * 100)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {overview.totalWatchedTvSeries} of {overview.totalStartedTvSeries} started series
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-10 animate-in fade-in">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-28 flex items-center justify-center">
            <Skeleton className="h-10 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 h-80 flex items-center justify-center">
          <Skeleton className="h-40 w-72" />
        </Card>
        <Card className="h-80 flex items-center justify-center">
          <Skeleton className="h-40 w-40 rounded-full" />
        </Card>
      </div>
    </div>
  );
}
