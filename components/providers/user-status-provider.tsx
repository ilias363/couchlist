"use client";

import { createContext, useContext, ReactNode } from "react";
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

  const movieStatuses = (allMovieStatuses ?? {}) as Record<number, StatusRecord>;
  const tvStatuses = (allTvStatuses ?? {}) as Record<number, StatusRecord>;

  const value: UserStatusContextValue = {
    movieStatuses,
    tvStatuses,
    getMovieStatus: (tmdbId: number) => movieStatuses[tmdbId]?.status,
    getTvStatus: (tmdbId: number) => tvStatuses[tmdbId]?.status,
    getStatus: (tmdbId: number, mediaType: "movie" | "tv") =>
      mediaType === "movie" ? movieStatuses[tmdbId]?.status : tvStatuses[tmdbId]?.status,
    isLoading: allMovieStatuses === undefined || allTvStatuses === undefined,
  };

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
}

export function useUserStatuses() {
  const context = useContext(UserStatusContext);
  if (!context) {
    throw new Error("useUserStatuses must be used within a UserStatusProvider");
  }
  return context;
}
