import { useQueryClient } from "@tanstack/react-query";
import { tmdbKeys } from "@/lib/tmdb/react-query";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { TMDBSeason, BaseTMDBSeason } from "@/lib/tmdb/types";
import { useCallback, useMemo } from "react";

export function useSeasonData(seriesId: number, seasons?: BaseTMDBSeason[]) {
  const queryClient = useQueryClient();
  const filteredSeasons = useMemo(
    () => seasons?.filter(s => s.season_number !== 0) ?? [],
    [seasons]
  );

  const fetchAllSeasons = useCallback((): Promise<TMDBSeason[]> => {
    return Promise.all(
      filteredSeasons.map(season =>
        queryClient.fetchQuery({
          queryKey: tmdbKeys.season(seriesId, season.season_number),
          queryFn: () => tmdbClient.getSeasonDetails(seriesId, season.season_number),
        })
      )
    );
  }, [filteredSeasons, queryClient, seriesId]);

  return {
    filteredSeasons,
    fetchAllSeasons,
  };
}
