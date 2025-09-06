import { TMDB_IMAGE_BASE_URL, WatchStatus } from "./types";

export function getTMDBImgUrl(
  path: string | null | undefined,
  size: string
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export const WATCH_STATUSES: Array<{ value: WatchStatus; label: string; }> = [
  { value: "want_to_watch", label: "Want to Watch" },
  { value: "currently_watching", label: "Currently Watching" },
  { value: "watched", label: "Watched" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];
