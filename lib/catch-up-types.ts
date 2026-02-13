export interface CatchUpItem {
  tvSeriesId: number;
  name: string;
  posterPath: string | null;
  tmdbStatus: string;
  totalEpisodes: number;
  watchedEpisodes: number;
  unwatchedEpisodes: number;
  unwatchedSeasons: CatchUpSeasonInfo[];
  upcomingSeasons: CatchUpSeasonInfo[];
}

export interface CatchUpSeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  watchedCount: number;
  airDate: string | null;
  isUpcoming: boolean;
}
