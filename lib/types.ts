export interface UserStats {
  overview: {
    totalStartedMovies: number;
    totalStartedTvSeries: number;
    totalWatchedMovies: number;
    totalWatchedTvSeries: number;
    totalWatchedEpisodes: number;
    totalWatchedSeasons: number;
    totalWatchTimeMinutes: number;
    totalWatchTimeHours: number;
  };
  distributions: {
    movies: { status: string; value: number }[];
    tvSeries: { status: string; value: number }[];
  };
  weeklyActivity: {
    label: string;
    start: number;
    end: number;
    movies: number;
    episodes: number;
  }[];
  dailyActivity: {
    date: string;
    movies: number;
    episodes: number;
    total: number;
  }[];
  weekdayDistribution: {
    weekday: number;
    movies: number;
    episodes: number;
    total: number;
  }[];
  watchTimeBreakdown: {
    moviesMinutes: number;
    episodesMinutes: number;
    totalMinutes: number;
  };
  streaks: {
    current: number;
    longest: number;
  };
  completionRates: {
    movies: number;
    tvSeries: number;
  };
  movies: {
    total: number;
    watched: number;
    wantToWatch: number;
    onHold: number;
    dropped: number;
  };
  tvSeries: {
    total: number;
    watched: number;
    currentlyWatching: number;
    upToDate: number;
    wantToWatch: number;
    onHold: number;
    dropped: number;
  };
  episodes: {
    totalWatchedEpisodes: number;
    totalWatchedSeasons: number;
  };
  recentActivity: {
    moviesWatched: number;
    episodesWatched: number;
    totalItems: number;
  };
  generatedAt: number;
}

export type ImportMode = "merge" | "replace";

export interface EpisodeStatus {
  isWatched: boolean;
  watchedDate?: number;
}

export interface ImportedDataResult {
  mode: ImportMode;
  movies: {
    inserted: number;
    updated: number;
    total: number;
  };
  tvSeries: {
    inserted: number;
    updated: number;
    total: number;
  };
  episodes: {
    inserted: number;
    updated: number;
    total: number;
  };
}
