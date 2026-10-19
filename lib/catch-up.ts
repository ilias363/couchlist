import type { CatchUpItem, CatchUpSeasonInfo } from "./catch-up-types";
import type { BaseTMDBSeason, TMDBSeason, TMDBTvSeries } from "./tmdb/types";

export type CatchUpSummary = { tvSeriesId: number; seasonWatchedCounts?: Record<string, number> };

export function seasonPlan(series: TMDBTvSeries, summary: CatchUpSummary, today: string) {
  return series.seasons.filter(season => season.season_number !== 0).map(season => {
    if (season.air_date && season.air_date > today) return { season, kind: "upcoming" as const };
    const last = series.last_episode_to_air;
    // A whole-series count hides old gaps. Match each season separately, and
    // require airing metadata before trusting a fully watched count. Unknown /
    // legacy summaries fall back to candidate-only ID checks, with no migration.
    const finished = season.air_date && season.air_date <= today && last?.air_date && last.air_date <= today &&
      (last.season_number > season.season_number ||
        (last.season_number === season.season_number && last.episode_number >= season.episode_count));
    const complete = finished && season.episode_count > 0 &&
      summary.seasonWatchedCounts?.[String(season.id)] === season.episode_count;
    return { season, kind: complete ? "complete" as const : "candidate" as const };
  });
}

export function comparisonIds(season: TMDBSeason, today: string) {
  return season.episodes.filter(ep => !ep.air_date || ep.air_date <= today).map(ep => ep.id);
}

// Return only completed shows. A slow/failed season never produces a misleading
// per-show percentage; other shows can still appear immediately.
export function buildCatchUpItem(
  series: TMDBTvSeries,
  summary: CatchUpSummary,
  today: string,
  seasons: Map<number, TMDBSeason>,
  watched: Map<number, Set<number>>,
): CatchUpItem | null | undefined {
  let totalEpisodes = 0;
  let watchedEpisodes = 0;
  let unknownDateEpisodes = 0;
  const unwatchedSeasons: CatchUpSeasonInfo[] = [];
  const upcomingSeasons: CatchUpSeasonInfo[] = [];
  const info = (s: BaseTMDBSeason): CatchUpSeasonInfo => ({
    seasonNumber: s.season_number, name: s.name, episodeCount: s.episode_count,
    watchedCount: 0, airDate: s.air_date, isUpcoming: false,
  });
  for (const { season, kind } of seasonPlan(series, summary, today)) {
    if (kind === "complete") {
      totalEpisodes += season.episode_count;
      watchedEpisodes += season.episode_count;
      continue;
    }
    if (kind === "upcoming") {
      upcomingSeasons.push({ ...info(season), isUpcoming: true });
      continue;
    }
    const details = seasons.get(season.season_number);
    const ids = watched.get(season.id);
    if (!details || !ids) return undefined;
    const aired = details.episodes.filter(ep => ep.air_date && ep.air_date <= today);
    const future = details.episodes.filter(ep => ep.air_date && ep.air_date > today);
    const undated = details.episodes.filter(ep => !ep.air_date && !ids.has(ep.id)).length +
      Math.max(0, season.episode_count - details.episodes.length);
    const count = aired.filter(ep => ids.has(ep.id)).length;
    totalEpisodes += aired.length;
    watchedEpisodes += count;
    unknownDateEpisodes += undated;
    if (count < aired.length || undated > 0) {
      unwatchedSeasons.push({ ...info(season), episodeCount: aired.length, watchedCount: count, unknownDateEpisodes: undated });
    }
    if (future.length || (details.episodes.length === 0 && season.episode_count === 0)) {
      upcomingSeasons.push({ ...info(season), isUpcoming: true, episodeCount: future.length || season.episode_count,
        airDate: future.map(ep => ep.air_date!).sort()[0] ?? season.air_date });
    }
  }
  const unwatchedEpisodes = totalEpisodes - watchedEpisodes;
  if (!unwatchedEpisodes && !unknownDateEpisodes && !upcomingSeasons.length) return null;
  return {
    tvSeriesId: summary.tvSeriesId, name: series.name, posterPath: series.poster_path, tmdbStatus: series.status,
    totalEpisodes, watchedEpisodes, unwatchedEpisodes, unknownDateEpisodes, unwatchedSeasons, upcomingSeasons,
  };
}
