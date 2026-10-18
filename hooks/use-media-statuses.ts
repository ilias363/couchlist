"use client";

import { useCallback, useMemo } from "react";
import { useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { getStatusBatches, type MediaStatusTarget } from "@/lib/media-statuses";
import type { WatchStatus } from "@/lib/tmdb/types";

interface MediaStatusItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  watchStatus?: WatchStatus;
}

/** Subscribe only to displayed titles whose source query didn't supply a status. */
export function useMediaStatuses(items: MediaStatusItem[]) {
  const queries = useMemo(() => {
    const targets: MediaStatusTarget[] = [];
    for (const item of items) {
      if (item.media_type !== "person" && item.watchStatus === undefined) {
        targets.push({ id: item.id, mediaType: item.media_type });
      }
    }
    return Object.fromEntries(getStatusBatches(targets).map((batch, i) => [
      String(i), { query: api.media.getStatuses, args: { items: batch } },
    ]));
  }, [items]);
  const results = useQueries(queries) as Record<
    string, FunctionReturnType<typeof api.media.getStatuses> | undefined | Error
  >;

  const statuses = useMemo(() => {
    const map = new Map<string, WatchStatus>();
    for (const result of Object.values(results)) {
      if (result instanceof Error) throw result;
      for (const item of result ?? []) map.set(`${item.mediaType}:${item.id}`, item.status);
    }
    for (const item of items) {
      if (item.watchStatus !== undefined) map.set(`${item.media_type}:${item.id}`, item.watchStatus);
    }
    return map;
  }, [items, results]);
  const getStatus = useCallback(
    (id: number, mediaType: "movie" | "tv") => statuses.get(`${mediaType}:${id}`),
    [statuses],
  );
  return { getStatus, isLoading: Object.values(results).some(result => result === undefined) };
}
