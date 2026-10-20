import type { FunctionArgs } from "convex/server";
import type { api } from "../convex/_generated/api";
import { validateUniqueIds, validateWatchDate } from "../convex/lib/tvWatchDates";

export const EPISODE_BATCH_SIZE = 100;
type SeasonBatch = FunctionArgs<typeof api.tv.bulkToggleSeasonEpisodes>;

export async function bulkToggleSeasonInBatches(
  mutate: (args: SeasonBatch) => Promise<unknown>,
  args: SeasonBatch,
) {
  validateUniqueIds(args.episodesInfo.map(episode => episode.episodeId), "episode");
  validateWatchDate(args.watchedAt);
  for (let offset = 0; offset < args.episodesInfo.length; offset += EPISODE_BATCH_SIZE) {
    await mutate({ ...args, episodesInfo: args.episodesInfo.slice(offset, offset + EPISODE_BATCH_SIZE) });
  }
}
