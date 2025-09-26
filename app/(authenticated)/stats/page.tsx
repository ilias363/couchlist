"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  DoughnutChart,
  BarChart,
  LineChart,
  statusPalette,
  doughnutOptions,
  weekdayLabel,
  barOptions,
} from "@/components/stats/charts";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, BarChart3, Clock, Film, Tv, Rows3, Play, Star } from "lucide-react";
import React from "react";
import { UserStats } from "@/lib/types";
import { MetricsGrid } from "@/components/stats/metrics-grid";
import { Section } from "@/components/stats/section";
import { AccentHeader } from "@/components/stats/accent-header";
import { KeyValue } from "@/components/stats/key-value";
import { Sparkline } from "@/components/stats/spark-line";

export default function StatsPage() {
  const data: UserStats | undefined = useQuery(api.stats.getUserStats, {});
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Insights</h1>
        <p className="text-muted-foreground max-w-prose">
          Visual breakdown of your viewing patterns & progress
        </p>
      </div>

      <MetricsGrid overview={overview} streaks={streaks} completionRates={completionRates} />

      <Section title="Recent Activity" description="Your viewing momentum and patterns">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="xl:col-span-2 overflow-hidden">
            <AccentHeader icon={BarChart3} title="Weekly Activity" subtitle="Last 12 weeks" />
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
          <Card className="flex flex-col h-full">
            <AccentHeader icon={Flame} title="Last 30 Days" subtitle="Recent momentum" />
            <CardContent className="flex flex-col justify-between h-full gap-4">
              <div className="space-y-4">
                <KeyValue label="Movies watched" value={recentActivity.moviesWatched} icon={Film} />
                <KeyValue
                  label="Episodes watched"
                  value={recentActivity.episodesWatched}
                  icon={Play}
                />
                <Separator />
                <KeyValue
                  label="Total items"
                  value={recentActivity.totalItems}
                  emphasize
                  icon={Star}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Daily activity Trend
                </p>
                <Sparkline data={dailyActivity.map(d => d.total)} />
              </div>
            </CardContent>
          </Card>
        </div>
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
      <footer className="pt-4">
        <p className="text-xs text-muted-foreground">
          Generated {new Date(generatedAt).toLocaleString()} • Data updates as you track items.
        </p>
      </footer>
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
