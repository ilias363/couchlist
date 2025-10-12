import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WatchStatus, TMDBSeason } from "@/lib/tmdb/types";

export function useTvSeriesStatus(tvSeriesId: number) {
  const [updating, setUpdating] = useState(false);
  const [watchedDialogOpen, setWatchedDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WatchStatus | null>(null);
  const [markEntireSeries, setMarkEntireSeries] = useState(false);

  const setSeriesStatus = useMutation(api.tv.setSeriesStatus);
  const deleteTvSeries = useMutation(api.tv.deleteTvSeries);
  const bulkToggle = useMutation(api.tv.bulkToggleSeasonEpisodes);

  const markAllEpisodesAsWatched = useCallback(
    async (seasons: TMDBSeason[], watchedAt?: number) => {
      const mutations = seasons
        .filter(s => s.episodes.length > 0)
        .map(s =>
          bulkToggle({
            tvSeriesId,
            seasonId: s.id,
            episodesInfo: s.episodes.map(e => ({
              episodeId: e.id,
              runtime: e.runtime ?? undefined,
            })),
            isWatched: true,
            watchedAt,
          })
        );
      await Promise.all(mutations);
    },
    [tvSeriesId, bulkToggle]
  );

  const handleStatusChange = useCallback(
    async (
      newStatus: WatchStatus | string,
      watchedAt?: number,
      seasons?: TMDBSeason[]
    ) => {
      try {
        setUpdating(true);

        if (newStatus === "watched" && markEntireSeries && seasons) {
          await markAllEpisodesAsWatched(seasons, watchedAt);
        }

        await setSeriesStatus({
          tvSeriesId,
          status: newStatus as WatchStatus,
          watchedAt,
        });
      } finally {
        setUpdating(false);
        setMarkEntireSeries(false);
      }
    },
    [tvSeriesId, markEntireSeries, setSeriesStatus, markAllEpisodesAsWatched]
  );

  const handleStatusClick = useCallback(
    (newStatus: WatchStatus | string) => {
      if (newStatus === "watched") {
        setPendingStatus(newStatus as WatchStatus);
        setWatchedDialogOpen(true);
        return;
      }
      handleStatusChange(newStatus);
    },
    [handleStatusChange]
  );

  const handleWatchedConfirm = useCallback(
    async (watchedAt?: number, seasons?: TMDBSeason[]) => {
      if (!pendingStatus) return;
      await handleStatusChange(pendingStatus, watchedAt, seasons);
      setWatchedDialogOpen(false);
      setPendingStatus(null);
    },
    [pendingStatus, handleStatusChange]
  );

  const handleRemove = useCallback(async () => {
    setUpdating(true);
    try {
      await deleteTvSeries({ tvSeriesId });
    } finally {
      setUpdating(false);
    }
  }, [tvSeriesId, deleteTvSeries]);

  return {
    updating,
    watchedDialogOpen,
    setWatchedDialogOpen,
    markEntireSeries,
    setMarkEntireSeries,
    handleStatusChange,
    handleStatusClick,
    handleWatchedConfirm,
    handleRemove,
  };
}
