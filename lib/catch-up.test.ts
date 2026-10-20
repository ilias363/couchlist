import { expect, test } from "vitest";
import { buildCatchUpItem, seasonPlan } from "./catch-up";
import type { BaseTMDBSeason, TMDBSeason, TMDBTvSeries, SeasonEpisode } from "./tmdb/types";

const today = "2026-10-19";
const meta = (n: number, count = 10, date: string | null = "2020-01-01") => ({
  id: n + 100, season_number: n, episode_count: count, name: `Season ${n}`, air_date: date,
}) as BaseTMDBSeason;
function show(seasons = [meta(0), ...Array.from({ length: 8 }, (_, i) => meta(i + 1))]) {
  return { id: 1, name: "Returning", status: "Returning Series", poster_path: null, seasons,
    last_episode_to_air: { season_number: 8, episode_number: 10, air_date: "2025-01-01" },
  } as TMDBTvSeries;
}
const summary = { tvSeriesId: 1, seasonWatchedCounts: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(101 + i), 10])),
  catchUpVerifiedSeasons: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(101 + i), { episodeCount: 10, airDate: "2020-01-01", watchedCount: 10 }])),
};
const episode = (id: number, air_date: string | null = "2020-01-01") => ({ id, air_date }) as SeasonEpisode;

test("unchanged returning history skips every regular season; specials never affect counts", () => {
  expect(seasonPlan(show(), summary, today).map(p => p.kind)).toEqual(Array(8).fill("complete"));
  expect(buildCatchUpItem(show(), summary, today, new Map(), new Map())).toBeNull();
});

test("per-season comparison catches new seasons, changed counts and old gaps despite equal series totals", () => {
  const revised = show([meta(1, 11), meta(2, 9), ...show().seasons.slice(3), meta(9, 1)]);
  const plans = seasonPlan(revised, summary, today);
  expect(plans.filter(p => p.kind === "candidate").map(p => p.season.season_number)).toEqual([1, 2, 9]);
  const gap = { ...summary, seasonWatchedCounts: { ...summary.seasonWatchedCounts, "101": 9 } };
  expect(seasonPlan(show(), gap, today).filter(p => p.kind === "candidate").map(p => p.season.season_number)).toEqual([1]);
  const season = { ...meta(1), _id: "season", episodes: Array.from({ length: 10 }, (_, i) => episode(i + 1)) } as TMDBSeason;
  const item = buildCatchUpItem(show(), gap, today, new Map([[1, season]]), new Map([[101, new Set(Array.from({ length: 9 }, (_, i) => i + 1))]]));
  expect(item).toMatchObject({ totalEpisodes: 80, watchedEpisodes: 79, unwatchedEpisodes: 1 });
});

test("upcoming seasons need no detail request, mixed future and unknown dates stay visible", () => {
  const details = show([meta(1, 4, null), meta(2, 10, "2027-01-01")]);
  const row = { tvSeriesId: 1, seasonWatchedCounts: { "101": 1 } };
  expect(seasonPlan(details, row, today).map(p => p.kind)).toEqual(["candidate", "upcoming"]);
  const seasons = new Map([[1, { ...meta(1), _id: "season", episodes: [episode(1), episode(2, today), episode(3, "2026-10-20"), episode(4, null)] } as TMDBSeason]]);
  const item = buildCatchUpItem(details, row, today, seasons, new Map([[101, new Set([1])]]));
  expect(item).toMatchObject({ totalEpisodes: 2, watchedEpisodes: 1, unwatchedEpisodes: 1, unknownDateEpisodes: 1 });
  expect(item?.upcomingSeasons.map(s => s.seasonNumber)).toEqual([1, 2]);
  expect(buildCatchUpItem(details, row, today, seasons, new Map())).toBeUndefined();
  // Legacy absent summaries and counts that include unaired episodes are checked.
  expect(seasonPlan(show(), { tvSeriesId: 1 }, today).every(p => p.kind === "candidate")).toBe(true);
  const airing = show([meta(8)]);
  airing.last_episode_to_air!.episode_number = 9;
  expect(seasonPlan(airing, summary, today)[0].kind).toBe("candidate");
});

test("a downward count revision cannot turn an unwatched gap into a completed season", () => {
  const details = show([meta(1, 9)]);
  // Watched IDs 1..9, TMDB removes watched ID 1; current ID 10 is still unwatched.
  const row = { ...summary, seasonWatchedCounts: { "101": 9 } };
  expect(seasonPlan(details, row, today)[0].kind).toBe("candidate");
  expect(seasonPlan(details, { tvSeriesId: 1, seasonWatchedCounts: { "101": 9 } }, today)[0].kind).toBe("candidate");
  const season = { ...meta(1, 9), _id: "season", episodes: Array.from({ length: 9 }, (_, i) => episode(i + 2)) } as TMDBSeason;
  const item = buildCatchUpItem(details, row, today, new Map([[1, season]]), new Map([[101, new Set(Array.from({ length: 9 }, (_, i) => i + 1))]]));
  expect(item).toMatchObject({ totalEpisodes: 9, watchedEpisodes: 8, unwatchedEpisodes: 1 });
});
