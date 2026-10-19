/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { FunctionReturnType } from "convex/server";

const modules = import.meta.glob("./**/*.ts");

test("summary pagination is independent of full history and isolated by authenticated user", async () => {
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 101, databaseQueries: 101 } });
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  await t.run(async ctx => {
    for (let i = 1; i <= 61; i++) await ctx.db.insert("userTvSeries", {
      userId: "owner", tvSeriesId: i, status: "up_to_date", seasonWatchedCounts: { "10": 80 }, createdAt: i, updatedAt: i,
    });
    await ctx.db.insert("userTvSeries", { userId: "other", tvSeriesId: 999, status: "up_to_date", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("userTvSeries", { userId: "owner", tvSeriesId: 998, status: "on_hold", createdAt: 1, updatedAt: 1 });
  });
  // 2,000 historical rows cannot fit in the enforced 101-read transaction.
  for (let batch = 0; batch < 20; batch++) await t.run(async ctx => {
    for (let j = 1; j <= 100; j++) await ctx.db.insert("userEpisodes", {
      userId: "owner", tvSeriesId: 61, seasonId: 10, episodeId: batch * 100 + j,
      isWatched: true, createdAt: 1, updatedAt: 1,
    });
  });
  const ids: number[] = [];
  // A summary page still succeeds with a 26-document budget despite history.
  const summaryReads = await owner.run(async ctx => {
    await ctx.runQuery(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } }, {
      transactionLimits: { documentsRead: 26 },
    });
    return ctx.meta.getTransactionMetrics();
  });
  expect(summaryReads.documentsRead.used).toBeLessThanOrEqual(26);
  expect(summaryReads.databaseQueries.used).toBe(1);
  let cursor: string | null = null;
  for (let i = 0; i < 3; i++) {
    const result: FunctionReturnType<typeof api.catchUp.list> = await owner.query(api.catchUp.list, { paginationOpts: { cursor, numItems: 25 } });
    expect(result.page.length).toBeLessThanOrEqual(25);
    expect(result.page.every(row => Object.keys(row).sort().join() === "seasonWatchedCounts,tvSeriesId")).toBe(true);
    ids.push(...result.page.map(row => row.tvSeriesId));
    cursor = result.continueCursor;
    expect(result.isDone).toBe(i === 2);
  }
  expect(ids).toEqual(Array.from({ length: 61 }, (_, i) => 61 - i));
  // Native reactive pages pin an end cursor and can grow beyond numItems.
  // Even an entire 61-show range must respect the server's 50-row budget.
  const expanded = await owner.query(api.catchUp.list, { paginationOpts: {
    cursor: null, endCursor: cursor!, numItems: 25, maximumRowsRead: 1000,
  } });
  expect(expanded.page.length).toBeLessThanOrEqual(50);
  expect(expanded.pageStatus).toBe("SplitRequired");
  expect(expanded.splitCursor).toBeTruthy();
  expect((await other.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page).toEqual([{ tvSeriesId: 999 }]);
  expect((await t.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 25 } })).page).toEqual([]);
  await expect(owner.query(api.catchUp.list, { paginationOpts: { cursor: null, numItems: 51 } })).rejects.toThrow(/1 and 50/);
  const candidateReads = await owner.run(async ctx => {
    const ids = await ctx.runQuery(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: Array.from({ length: 100 }, (_, i) => i + 1) });
    expect(ids).toHaveLength(100);
    return ctx.meta.getTransactionMetrics();
  });
  expect(candidateReads.documentsRead.used).toBe(100);
  expect(candidateReads.databaseQueries.used).toBe(100);
  console.info(`Catch-up in-memory reads with 2,000 history rows: summary page ${summaryReads.documentsRead.used} documents / ${summaryReads.databaseQueries.used} query; candidate IDs ${candidateReads.documentsRead.used} documents / ${candidateReads.databaseQueries.used} queries.`);
  expect(await other.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await t.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 60, seasonId: 10, episodeIds: [1] })).toEqual([]);
  expect(await owner.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 11, episodeIds: [1] })).toEqual([]);
  await expect(owner.query(api.catchUp.watchedIds, { tvSeriesId: 61, seasonId: 10, episodeIds: Array.from({ length: 101 }, (_, i) => i + 1) })).rejects.toThrow(/at most 100/);
});
