export const STATUS_BATCH_SIZE = 100;

export type MediaStatusTarget = {
  id: number;
  mediaType: "movie" | "tv";
};

// Canonical batches let Convex share identical subscriptions across consumers.
export function getStatusBatches(targets: MediaStatusTarget[]): MediaStatusTarget[][] {
  const unique = new Map(targets.map(target => [`${target.mediaType}:${target.id}`, target]));
  const sorted = [...unique.values()].sort(
    (a, b) => a.mediaType.localeCompare(b.mediaType) || a.id - b.id,
  );
  const batches: MediaStatusTarget[][] = [];
  for (let i = 0; i < sorted.length; i += STATUS_BATCH_SIZE) {
    batches.push(sorted.slice(i, i + STATUS_BATCH_SIZE));
  }
  return batches;
}
