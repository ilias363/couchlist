"use client";

import { useCallback, useMemo, useState } from "react";
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
export function useMediaStatuses(items: MediaStatusItem[], userId: string | undefined) {
  // This identity scopes the client cache only; queries still authorize on the server.
  const [previous, setPrevious] = useState(() => ({
    userId,
    statuses: new Map<string, WatchStatus>(),
  }));
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
    for (const [key, query] of Object.entries(queries)) {
      const result = results[key];
      if (result instanceof Error) throw result;
      if (result === undefined && userId !== undefined && previous.userId === userId) {
        // Re-batching can replace every subscription. Retain only still-requested
        // titles while pending; a resolved missing row must clear its old status.
        for (const item of query.args.items) {
          const key = `${item.mediaType}:${item.id}`;
          const status = previous.statuses.get(key);
          if (status !== undefined) map.set(key, status);
        }
      }
      for (const item of result ?? []) map.set(`${item.mediaType}:${item.id}`, item.status);
    }
    for (const item of items) {
      if (item.watchStatus !== undefined) map.set(`${item.media_type}:${item.id}`, item.watchStatus);
    }
    return map;
  }, [items, queries, results, previous, userId]);
  if (
    previous.userId !== userId || previous.statuses.size !== statuses.size ||
    [...statuses].some(([key, status]) => previous.statuses.get(key) !== status)
  ) {
    setPrevious({ userId, statuses });
  }
  const getStatus = useCallback(
    (id: number, mediaType: "movie" | "tv") => statuses.get(`${mediaType}:${id}`),
    [statuses],
  );
  return { getStatus, isLoading: Object.values(results).some(result => result === undefined) };
}
