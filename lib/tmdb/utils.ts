import {
  ExternalLink,
  MovieExternalIDs,
  TMDB_IMAGE_BASE_URL,
  TvSeriesExternalIDs,
  WatchStatus,
} from "./types";

export function getTMDBImgUrl(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export const WATCH_STATUSES: Array<{ value: WatchStatus; label: string }> = [
  { value: "want_to_watch", label: "Want to Watch" },
  { value: "currently_watching", label: "Currently Watching" },
  { value: "watched", label: "Watched" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export function getExternalLinks(args: {
  externalIds?: (MovieExternalIDs | TvSeriesExternalIDs) | null;
  homepage?: string | null;
  tmdbId?: number;
  type?: "movie" | "tv";
}): ExternalLink[] {
  const { externalIds, homepage, tmdbId, type } = args || {};
  const links: ExternalLink[] = [];

  if (homepage) links.push({ key: "homepage", label: "Official site", href: homepage });
  if (typeof tmdbId === "number" && type)
    links.push({
      key: "tmdb",
      label: "TMDB",
      href: `https://www.themoviedb.org/${type}/${tmdbId}`,
    });

  if (externalIds?.imdb_id)
    links.push({
      key: "imdb",
      label: "IMDb",
      href: `https://www.imdb.com/title/${externalIds.imdb_id}/`,
    });
  if (externalIds && "tvdb_id" in externalIds && externalIds.tvdb_id)
    links.push({
      key: "tvdb",
      label: "TVDB",
      href: `https://thetvdb.com/?tab=series&id=${externalIds.tvdb_id}`,
    });
  if (externalIds?.wikidata_id)
    links.push({
      key: "wikidata",
      label: "Wikidata",
      href: `https://www.wikidata.org/wiki/${externalIds.wikidata_id}`,
    });
  if (externalIds?.facebook_id)
    links.push({
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/${externalIds.facebook_id}`,
    });
  if (externalIds?.instagram_id)
    links.push({
      key: "instagram",
      label: "Instagram",
      href: `https://www.instagram.com/${externalIds.instagram_id}`,
    });
  if (externalIds?.twitter_id)
    links.push({
      key: "twitter",
      label: "X (Twitter)",
      href: `https://twitter.com/${externalIds.twitter_id}`,
    });

  return links;
}
