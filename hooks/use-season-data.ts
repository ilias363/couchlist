import { useMemo } from "react";
import { useBatchTMDBSeasons } from "@/lib/tmdb/react-query";
import { TMDBSeason, BaseTMDBSeason } from "@/lib/tmdb/types";

export function useSeasonData(seriesId: number, seasons?: BaseTMDBSeason[]) {
  const filteredSeasons = seasons?.filter(s => s.season_number !== 0) || [];

  const { queries: seasonQueries } = useBatchTMDBSeasons(
    seriesId,
    filteredSeasons.map(s => s.season_number)
  );

  const fetchAllSeasons = async (): Promise<TMDBSeason[]> => {
    const results = await Promise.all(
      seasonQueries.map(async q => q.data ?? (await q.refetch()).data)
    );
    return results.filter((s): s is TMDBSeason => !!s);
  };

  return {
    filteredSeasons,
    fetchAllSeasons,
  };
}
