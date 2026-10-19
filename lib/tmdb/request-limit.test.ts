import { expect, test } from "vitest";
import { TMDBClient } from "./client-api";

test("TMDB transport caps concurrency at six and releases slots after failures", async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const client = new TMDBClient(async () => {
    active++; calls++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return new Response("{}", { status: calls % 3 === 0 ? 500 : 200 });
  });
  const result = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => client.getTVSeriesDetails(i + 1)));
  expect(calls).toBe(25); expect(maximum).toBe(6); expect(active).toBe(0);
  expect(result.some(r => r.status === "rejected")).toBe(true);
  expect(result.some(r => r.status === "fulfilled")).toBe(true);
});
