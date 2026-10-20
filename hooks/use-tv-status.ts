import { useState, useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WatchStatus, TMDBSeason } from "@/lib/tmdb/types";
import { waitForDataOperation } from "@/lib/data-operations-client";
import { bulkToggleSeasonInBatches } from "@/lib/tv-watch-batches";

export function useTvSeriesStatus(tvSeriesId: number) {
  const convex = useConvex();
  const [updating, setUpdating] = useState(false);
  const [watchedDialogOpen, setWatchedDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WatchStatus | null>(null);
  const [markEntireSeries, setMarkEntireSeries] = useState(false);

  const setSeriesStatus = useMutation(api.tv.setSeriesStatus);
  const deleteTvSeries = useMutation(api.tv.deleteTvSeries);
  const bulkToggle = useMutation(api.tv.bulkToggleSeasonEpisodes);

  const markAllEpisodesAsWatched = useCallback(
    async (seasons: TMDBSeason[], watchedAt?: number) => {
      for (const s of seasons) {
        await bulkToggleSeasonInBatches(bulkToggle, {
          tvSeriesId,
          seasonId: s.id,
          episodesInfo: s.episodes.map(e => ({
            episodeId: e.id,
            runtime: e.runtime ?? undefined,
          })),
          isWatched: true,
          watchedAt,
        });
      }
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
        });
        setMarkEntireSeries(false);
      } finally {
        setUpdating(false);
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
      const jobId = await deleteTvSeries({ tvSeriesId });
      await waitForDataOperation(convex, jobId);
    } finally {
      setUpdating(false);
    }
  }, [tvSeriesId, deleteTvSeries, convex]);

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
