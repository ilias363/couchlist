import { useBatchTMDBSeasons } from "@/lib/tmdb/react-query";
import { TMDBSeason, BaseTMDBSeason } from "@/lib/tmdb/types";
import { useCallback, useMemo } from "react";

export function useSeasonData(seriesId: number, seasons?: BaseTMDBSeason[]) {
  const filteredSeasons = useMemo(
    () => seasons?.filter(s => s.season_number !== 0) ?? [],
    [seasons]
  );

  const { queries: seasonQueries } = useBatchTMDBSeasons(
    seriesId,
    filteredSeasons.map(s => s.season_number),
    { enabled: seriesId > 0 && filteredSeasons.length > 0 }
  );

  const fetchAllSeasons = useCallback(async (): Promise<TMDBSeason[]> => {
    const results = await Promise.all(
      seasonQueries.map(async q => q.data ?? (await q.refetch()).data)
    );
    return results.filter((s): s is TMDBSeason => !!s);
  }, [seasonQueries]);

  return {
    filteredSeasons,
    fetchAllSeasons,
  };
}
