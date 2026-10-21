// @vitest-environment happy-dom
import { act, StrictMode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";
import { emptyStats, DAY } from "../convex/lib/statsModel";
import { StatsSnapshotProvider, useStatsSnapshot } from "../components/providers/stats-snapshot-provider";

type Snapshot = FunctionReturnType<typeof api.stats.getUserStats>;
const state = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  authenticated: true, payload: undefined as Snapshot | undefined,
  listeners: new Set<(snapshot: Snapshot | undefined) => void>(), subscriptions: 0,
  ensure: vi.fn().mockResolvedValue(null), refresh: vi.fn().mockResolvedValue(null),
}));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("convex/react", async () => {
  const { useState, useEffect } = await import("react");
  const { getFunctionName } = await import("convex/server");
  return {
    useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":ensureStats") ? state.ensure : state.refresh,
    useQuery: (_ref: unknown, args: unknown) => {
      const [value, setValue] = useState<Snapshot | undefined>();
      const skipped = args === "skip";
      useEffect(() => {
        if (skipped) return;
        state.subscriptions++;
        state.listeners.add(setValue);
        setValue(state.payload);
        return () => { state.listeners.delete(setValue); };
      }, [skipped]);
      return value;
    },
  };
});
let root: Root, element: HTMLDivElement;
let view: ReturnType<typeof useStatsSnapshot>;
let renders: (number | undefined)[];
const NOW = Date.UTC(2026, 9, 21, 12);
function Probe() {
  const value = useStatsSnapshot();
  useEffect(() => { view = value; renders.push(value.data?.generatedAt); }, [value]);
  return <><p>{value.data ? `Snapshot ${value.data.generatedAt}` : "Loading"}</p><p role="status">{value.message}</p><button disabled={value.disabled} onClick={() => void value.refresh()}>Refresh</button></>;
}
async function render(visible = true, strict = false) {
  const ui = <StatsSnapshotProvider>{visible ? <Probe /> : <p>Another route</p>}</StatsSnapshotProvider>;
  await act(async () => root.render(strict ? <StrictMode>{ui}</StrictMode> : ui));
}
async function publish(payload: Snapshot) {
  state.payload = payload;
  await act(async () => { for (const listener of state.listeners) listener(payload); });
}
const snapshot = (time = NOW): Snapshot => ({ ownerId: "owner", stats: emptyStats(time), lastRefreshed: time, blocked: false, job: null });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.user = { id: "owner" }; state.authenticated = true; state.payload = snapshot();
  state.listeners.clear(); state.subscriptions = 0; state.ensure.mockReset().mockResolvedValue(null); state.refresh.mockReset().mockResolvedValue(null);
  renders = []; element = document.createElement("div"); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.clearAllTimers(); vi.useRealTimers(); });

test("a warm route revisit immediately reuses the mounted private subscription without a mutation or empty render", async () => {
  await render();
  expect(element.textContent).toContain(`Snapshot ${NOW}`);
  await render(false);
  renders = [];
  await render(true);
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(value => value === NOW)).toBe(true);
  expect(state.subscriptions).toBe(1);
  expect(state.ensure).not.toHaveBeenCalled();
  expect(state.refresh).not.toHaveBeenCalled();
});

test("stale/missing data triggers bounded work after authentication; Strict Mode repeats retain a snapshot", async () => {
  state.payload = snapshot(NOW - DAY); state.authenticated = false;
  await render(true, true);
  expect(state.ensure).not.toHaveBeenCalled();
  state.authenticated = true;
  await render(true, true);
  expect(state.ensure).toHaveBeenCalled();
  expect(element.textContent).toContain(`Snapshot ${NOW - DAY}`);
  const running: Snapshot = { ...state.payload, job: { jobId: "job" as never, status: "running", phase: "episodes", processed: 128, restarts: 0, updatedAt: NOW, error: null } };
  await publish(running);
  expect(element.textContent).toContain("128 records read");
  expect(view.disabled).toBe(true);
  const calls = state.ensure.mock.calls.length;
  await render(false, true); await render(true, true);
  expect(state.ensure).toHaveBeenCalledTimes(calls);
  expect(view.data?.generatedAt).toBe(NOW - DAY);
});

test("failed refresh keeps the snapshot, exposes retry, handles rejected requests, and shows completion", async () => {
  await render();
  await publish({ ...snapshot(NOW - DAY), job: { jobId: "job" as never, status: "failed", phase: "movies", processed: 64, restarts: 0, updatedAt: NOW, error: "Failed" } });
  expect(view.failed).toBe(true);
  expect(view.data?.generatedAt).toBe(NOW - DAY);
  expect(view.disabled).toBe(false);
  state.refresh.mockRejectedValueOnce(new Error("offline"));
  await act(async () => view.refresh());
  expect(element.textContent).toContain("Couldn't start");
  // Completion from another tab clears the obsolete local request error too.
  await publish({ ...snapshot(), job: { jobId: "job" as never, status: "complete", phase: "cleanup", processed: 100, restarts: 0, updatedAt: NOW, error: null } });
  expect(view.failed).toBe(false);
  expect(view.data?.generatedAt).toBe(NOW);
  expect(element.textContent).toContain("up to date");
});

test("blocked operations prevent auto/manual refresh and hide account snapshots; switching owners clears retained data", async () => {
  state.payload = { ...snapshot(NOW - DAY), blocked: true };
  await render();
  expect(state.ensure).not.toHaveBeenCalled(); expect(view.disabled).toBe(true);
  await publish({ ...state.payload, stats: null, lastRefreshed: null });
  expect(view.data).toBeUndefined();
  state.user = { id: "other" }; state.payload = snapshot(); // Simulate the old Convex query cache.
  renders = [];
  await render();
  expect(renders.every(value => value === undefined)).toBe(true);
  await publish({ ...snapshot(NOW + 1), ownerId: "other" });
  expect(view.data?.generatedAt).toBe(NOW + 1);
  state.authenticated = false;
  await render();
  expect(view.data).toBeUndefined();
});

test("a stalled checkpoint can resume, and a clock tick expires a mounted snapshot", async () => {
  await render();
  await act(async () => vi.advanceTimersByTime(DAY));
  expect(state.ensure).toHaveBeenCalledTimes(1);
  await publish({ ...snapshot(), job: { jobId: "job" as never, status: "running", phase: "movies", processed: 64, restarts: 1, updatedAt: NOW + DAY - 60_000, error: null } });
  expect(view.stalled).toBe(true); expect(view.disabled).toBe(false);
  await act(async () => view.refresh());
  expect(state.refresh).toHaveBeenCalledTimes(1);
});
