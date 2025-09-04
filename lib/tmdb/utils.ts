import { BackdropSize, PosterSize, StillSize, TMDB_IMAGE_BASE_URL, WatchStatus } from "./types";

export function getTMDBPosterImgUrl(
    path: string | null | undefined,
    size: PosterSize = "w500"
): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function getTMDBBackdropImgUrl(
    path: string | null | undefined,
    size: BackdropSize = "w1280"
): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function getTMDBStillImgUrl(
    path: string | null | undefined,
    size: StillSize = "w300"
): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export const WATCH_STATUSES: Array<{ value: WatchStatus; label: string; color: string }> = [
    { value: "want_to_watch", label: "Want to Watch", color: "blue" },
    { value: "currently_watching", label: "Currently Watching", color: "green" },
    { value: "watched", label: "Watched", color: "gray" },
    { value: "on_hold", label: "On Hold", color: "yellow" },
    { value: "dropped", label: "Dropped", color: "red" },
];

export function getStatusInfo(status: WatchStatus) {
    return WATCH_STATUSES.find(s => s.value === status) || WATCH_STATUSES[0];
}