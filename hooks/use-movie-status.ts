import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WatchStatus } from "@/lib/tmdb/types";

export function useMovieStatus(movieId: number, runtime?: number | null) {
  const [updating, setUpdating] = useState(false);
  const [watchedDialogOpen, setWatchedDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WatchStatus | null>(null);

  const setMovieStatus = useMutation(api.movie.setMovieStatus);
  const deleteMovie = useMutation(api.movie.deleteMovie);

  const handleStatusChange = useCallback(
    async (newStatus: WatchStatus | string, watchedAt?: number) => {
      try {
        setUpdating(true);
        await setMovieStatus({
          movieId,
          status: newStatus as "want_to_watch" | "watched" | "on_hold" | "dropped",
          runtime: runtime ?? undefined,
          watchedAt,
        });
      } finally {
        setUpdating(false);
      }
    },
    [movieId, runtime, setMovieStatus]
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
    async (watchedAt?: number) => {
      if (!pendingStatus) return;
      await handleStatusChange(pendingStatus, watchedAt);
      setWatchedDialogOpen(false);
      setPendingStatus(null);
    },
    [pendingStatus, handleStatusChange]
  );

  const handleRemove = useCallback(async () => {
    setUpdating(true);
    try {
      await deleteMovie({ movieId });
    } finally {
      setUpdating(false);
    }
  }, [movieId, deleteMovie]);

  return {
    updating,
    watchedDialogOpen,
    setWatchedDialogOpen,
    handleStatusChange,
    handleStatusClick,
    handleWatchedConfirm,
    handleRemove,
  };
}
