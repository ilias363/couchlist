import { v } from "convex/values";
import type { UserStats } from "../../lib/types";
import type { Doc } from "../_generated/dataModel";

const activity = { movies: v.number(), episodes: v.number() };
const distribution = v.array(v.object({ status: v.string(), value: v.number() }));
export const statsValidator = v.object({
  overview: v.object({
    totalStartedMovies: v.number(), totalStartedTvSeries: v.number(), totalWatchedMovies: v.number(),
    totalWatchedTvSeries: v.number(), totalWatchedEpisodes: v.number(), totalWatchedSeasons: v.number(),
    totalWatchTimeMinutes: v.number(), totalWatchTimeHours: v.number(),
  }),
  distributions: v.object({ movies: distribution, tvSeries: distribution }),
  weeklyActivity: v.array(v.object({ label: v.string(), start: v.number(), end: v.number(), ...activity })),
  dailyActivity: v.array(v.object({ date: v.string(), ...activity, total: v.number() })),
  weekdayDistribution: v.array(v.object({ weekday: v.number(), ...activity, total: v.number() })),
  watchTimeBreakdown: v.object({ moviesMinutes: v.number(), episodesMinutes: v.number(), totalMinutes: v.number() }),
  streaks: v.object({ current: v.number(), longest: v.number() }),
  completionRates: v.object({ movies: v.number(), tvSeries: v.number() }),
  movies: v.object({ total: v.number(), watched: v.number(), wantToWatch: v.number(), onHold: v.number(), dropped: v.number() }),
  tvSeries: v.object({ total: v.number(), watched: v.number(), currentlyWatching: v.number(), upToDate: v.number(), wantToWatch: v.number(), onHold: v.number(), dropped: v.number() }),
  episodes: v.object({ totalWatchedEpisodes: v.number(), totalWatchedSeasons: v.number() }),
  recentActivity: v.object({ moviesWatched: v.number(), episodesWatched: v.number(), totalItems: v.number() }),
  generatedAt: v.number(),
});

export const DAY = 86_400_000;
export const STATS_TTL = DAY;
// Convex's default runtime uses UTC. Keep every window anchored to this one
// timestamp, including across checkpoint retries and midnight boundaries.
export function emptyStats(now: number): UserStats {
  const today = Math.floor(now / DAY) * DAY;
  return {
    overview: { totalStartedMovies: 0, totalStartedTvSeries: 0, totalWatchedMovies: 0, totalWatchedTvSeries: 0, totalWatchedEpisodes: 0, totalWatchedSeasons: 0, totalWatchTimeMinutes: 0, totalWatchTimeHours: 0 },
    distributions: { movies: [], tvSeries: [] },
    weeklyActivity: Array.from({ length: 12 }, (_, i) => {
      const end = now - (11 - i) * 7 * DAY;
      const start = end - 7 * DAY;
      const date = new Date(start);
      return { label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, start, end, movies: 0, episodes: 0 };
    }),
    dailyActivity: Array.from({ length: 30 }, (_, i) => ({ date: new Date(today - (29 - i) * DAY).toISOString().slice(0, 10), movies: 0, episodes: 0, total: 0 })),
    weekdayDistribution: Array.from({ length: 7 }, (_, weekday) => ({ weekday, movies: 0, episodes: 0, total: 0 })),
    watchTimeBreakdown: { moviesMinutes: 0, episodesMinutes: 0, totalMinutes: 0 },
    streaks: { current: 0, longest: 0 }, completionRates: { movies: 100, tvSeries: 100 },
    movies: { total: 0, watched: 0, wantToWatch: 0, onHold: 0, dropped: 0 },
    tvSeries: { total: 0, watched: 0, currentlyWatching: 0, upToDate: 0, wantToWatch: 0, onHold: 0, dropped: 0 },
    episodes: { totalWatchedEpisodes: 0, totalWatchedSeasons: 0 },
    recentActivity: { moviesWatched: 0, episodesWatched: 0, totalItems: 0 }, generatedAt: now,
  };
}

// Preserve the existing stats date semantics: absent/zero dates don't count as
// dated activity; recent movies include retained dates even after status edits.
export function activityDay(date: number | undefined) {
  return date && Number.isFinite(date) && Math.abs(date) <= 8.64e15 ? Math.floor(date / DAY) * DAY : null;
}
function addActivity(stats: UserStats, kind: "movies" | "episodes", date: number) {
  const day = activityDay(date);
  if (day === null) return;
  const daily = stats.dailyActivity.find(d => d.date === new Date(day).toISOString().slice(0, 10));
  if (daily) { daily[kind]++; daily.total++; }
  // Legacy output uses JS getDay(): Sunday=0. Keep the existing field meaning.
  const weekday = stats.weekdayDistribution[new Date(date).getUTCDay()];
  weekday[kind]++; weekday.total++;
  const week = stats.weeklyActivity.find(w => date > w.start && date <= w.end);
  if (week) week[kind]++;
}
const statusKey = { watched: "watched", want_to_watch: "wantToWatch", on_hold: "onHold", dropped: "dropped", currently_watching: "currentlyWatching", up_to_date: "upToDate" } as const;
export function addMovie(stats: UserStats, movie: Doc<"userMovies">) {
  stats.movies.total++;
  stats.movies[statusKey[movie.status]]++;
  if (movie.watchedDate && movie.watchedDate > stats.generatedAt - 30 * DAY) stats.recentActivity.moviesWatched++;
  if (movie.status !== "watched") return;
  stats.watchTimeBreakdown.moviesMinutes += movie.runtime || 0;
  if (movie.watchedDate) addActivity(stats, "movies", movie.watchedDate);
}
export function addSeries(stats: UserStats, series: Doc<"userTvSeries">) {
  stats.tvSeries.total++;
  stats.tvSeries[statusKey[series.status]]++;
}
export function addEpisode(stats: UserStats, episode: Doc<"userEpisodes">) {
  stats.episodes.totalWatchedEpisodes++;
  stats.watchTimeBreakdown.episodesMinutes += episode.runtime || 0;
  if (episode.watchedDate && episode.watchedDate > stats.generatedAt - 30 * DAY) stats.recentActivity.episodesWatched++;
  if (episode.watchedDate) addActivity(stats, "episodes", episode.watchedDate);
}
export function finishStats(stats: UserStats, previousDay?: number) {
  const m = stats.movies, t = stats.tvSeries, e = stats.episodes, w = stats.watchTimeBreakdown;
  w.totalMinutes = w.moviesMinutes + w.episodesMinutes;
  stats.overview = {
    totalStartedMovies: m.total - m.wantToWatch, totalStartedTvSeries: t.total - t.wantToWatch,
    totalWatchedMovies: m.watched, totalWatchedTvSeries: t.watched + t.upToDate,
    totalWatchedEpisodes: e.totalWatchedEpisodes, totalWatchedSeasons: e.totalWatchedSeasons,
    totalWatchTimeMinutes: w.totalMinutes, totalWatchTimeHours: Math.round(w.totalMinutes / 60),
  };
  stats.distributions = {
    movies: [{ status: "Watched", value: m.watched }, { status: "Want to Watch", value: m.wantToWatch }, { status: "On Hold", value: m.onHold }, { status: "Dropped", value: m.dropped }],
    tvSeries: [{ status: "Watched", value: t.watched }, { status: "Currently Watching", value: t.currentlyWatching }, { status: "Up to Date", value: t.upToDate }, { status: "Want to Watch", value: t.wantToWatch }, { status: "On Hold", value: t.onHold }, { status: "Dropped", value: t.dropped }],
  };
  stats.completionRates = {
    movies: m.total - m.wantToWatch ? m.watched / (m.total - m.wantToWatch) : 100,
    tvSeries: t.total - t.wantToWatch ? (t.watched + t.upToDate) / (t.total - t.wantToWatch) : 100,
  };
  stats.recentActivity.totalItems = stats.recentActivity.moviesWatched + stats.recentActivity.episodesWatched;
  if (previousDay !== undefined && Math.floor(stats.generatedAt / DAY) * DAY - previousDay > DAY) stats.streaks.current = 0;
  return stats;
}
