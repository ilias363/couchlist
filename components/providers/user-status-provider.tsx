"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQueries } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WatchStatus } from "@/lib/tmdb/types";

interface StatusRecord {
  status: WatchStatus;
}

interface UserStatusContextValue {
  movieStatuses: Record<number, StatusRecord>;
  tvStatuses: Record<number, StatusRecord>;
  getMovieStatus: (tmdbId: number) => WatchStatus | undefined;
  getTvStatus: (tmdbId: number) => WatchStatus | undefined;
  getStatus: (tmdbId: number, mediaType: "movie" | "tv") => WatchStatus | undefined;
  isLoading: boolean;
}

const UserStatusContext = createContext<UserStatusContextValue | null>(null);

export function UserStatusProvider({ children }: { children: ReactNode }) {
  const { allMovieStatuses, allTvStatuses } = useQueries({
    allMovieStatuses: { query: api.movie.listAllMovieStatuses, args: {} },
    allTvStatuses: { query: api.tv.listAllTvStatuses, args: {} },
  });

  const movieStatuses = useMemo(
    () => (allMovieStatuses ?? {}) as Record<number, StatusRecord>,
    [allMovieStatuses],
  );
  const tvStatuses = useMemo(
    () => (allTvStatuses ?? {}) as Record<number, StatusRecord>,
    [allTvStatuses],
  );
  const isLoading = allMovieStatuses === undefined || allTvStatuses === undefined;

  const getMovieStatus = useCallback(
    (tmdbId: number) => movieStatuses[tmdbId]?.status,
    [movieStatuses],
  );
  const getTvStatus = useCallback((tmdbId: number) => tvStatuses[tmdbId]?.status, [tvStatuses]);
  const getStatus = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv") =>
      mediaType === "movie" ? movieStatuses[tmdbId]?.status : tvStatuses[tmdbId]?.status,
    [movieStatuses, tvStatuses],
  );

  const value = useMemo<UserStatusContextValue>(
    () => ({
      movieStatuses,
      tvStatuses,
      getMovieStatus,
      getTvStatus,
      getStatus,
      isLoading,
    }),
    [movieStatuses, tvStatuses, getMovieStatus, getTvStatus, getStatus, isLoading],
  );

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
}

export function useUserStatuses() {
  const context = useContext(UserStatusContext);
  if (!context) {
    throw new Error("useUserStatuses must be used within a UserStatusProvider");
  }
  return context;
}
