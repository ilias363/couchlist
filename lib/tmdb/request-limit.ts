// Shared by TMDBClient calls: metadata still lives in React Query / Next's
// existing cache. This queue only caps in-flight work, including response bodies.
export const TMDB_CONCURRENCY = 6;
let active = 0;
const waiting: (() => void)[] = [];

export async function limitTMDBRequest<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const start = () => {
      signal?.removeEventListener("abort", abort);
      active++;
      resolve();
    };
    const abort = () => {
      const index = waiting.indexOf(start);
      if (index !== -1) waiting.splice(index, 1);
      reject(signal?.reason);
    };
    if (active < TMDB_CONCURRENCY) start();
    else {
      waiting.push(start);
      signal?.addEventListener("abort", abort, { once: true });
    }
  });
  try {
    signal?.throwIfAborted();
    return await request();
  } finally {
    active--;
    waiting.shift()?.();
  }
}
