import { UserStats } from "@/lib/types";
import { Clock, Film, Flame, Play, Trophy, Tv } from "lucide-react";
import { MetricCard } from "./metric-card";

export function MetricsGrid({
  overview,
  streaks,
  completionRates,
}: {
  overview: UserStats["overview"];
  streaks: UserStats["streaks"];
  completionRates: UserStats["completionRates"];
}) {
  const metrics = [
    {
      label: "Movies",
      value: overview.totalStartedMovies,
      sub: `${overview.totalWatchedMovies} watched`,
      icon: Film,
      color: "from-blue-500 to-indigo-600",
    },
    {
      label: "TV Series",
      value: overview.totalStartedTvSeries,
      sub: `${overview.totalWatchedTvSeries} completed`,
      icon: Tv,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "Episodes",
      value: overview.totalWatchedEpisodes,
      sub: `${overview.totalWatchedSeasons} seasons`,
      icon: Play,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Watch Time",
      value: `${overview.totalWatchTimeHours}h`,
      sub: `${overview.totalWatchTimeMinutes} min`,
      icon: Clock,
      color: "from-orange-500 to-red-600",
    },
    {
      label: "Streak",
      value: `${streaks.current}d`,
      sub: `Longest ${streaks.longest}d`,
      icon: Flame,
      color: "from-yellow-500 to-orange-600",
    },
    {
      label: "Completion",
      value: `${Math.round(completionRates.movies * 100)}% / ${Math.round(
        completionRates.tvSeries * 100
      )}%`,
      sub: "Movies / Series",
      icon: Trophy,
      color: "from-green-500 to-emerald-600",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {metrics.map(metric => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}
