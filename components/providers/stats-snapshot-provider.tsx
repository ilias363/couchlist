"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Snapshot = FunctionReturnType<typeof api.stats.getUserStats>;
const StatsContext = createContext<Snapshot | undefined>(undefined);

// This layout-owned subscription survives stats route unmounts. It reads only
// the cached snapshot/checkpoint, and never starts background work by itself.
export function StatsSnapshotProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <OwnedSnapshot key={user?.id ?? "anonymous"} ownerId={user?.id}>{children}</OwnedSnapshot>;
}
function OwnedSnapshot({ children, ownerId }: { children: ReactNode; ownerId?: string }) {
  const { isAuthenticated } = useConvexAuth();
  const snapshot = useQuery(api.stats.getUserStats, isAuthenticated && ownerId ? {} : "skip");
  // A shared Convex client can briefly retain its last query result during an
  // account switch. Only expose a result whose SERVER-derived owner matches.
  return <StatsContext.Provider value={isAuthenticated && snapshot?.ownerId === ownerId ? snapshot : undefined}>{children}</StatsContext.Provider>;
}

export function useStatsSnapshot() {
  const snapshot = useContext(StatsContext);
  const ensureStats = useMutation(api.stats.ensureStats);
  const refreshStats = useMutation(api.stats.refreshStats);
  const [now, setNow] = useState(() => Date.now());
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const stale = !!snapshot && (snapshot.lastRefreshed === null || now - snapshot.lastRefreshed >= 24 * 60 * 60 * 1000);
  const requestKey = snapshot ? `${snapshot.lastRefreshed}:${snapshot.job?.jobId ?? "none"}` : null;
  const errorKey = `${requestKey}:${snapshot?.job?.status}:${snapshot?.job?.updatedAt}`;
  const currentError = requestError?.key === errorKey ? requestError.message : null;
  useEffect(() => {
    if (!snapshot || snapshot.blocked || !stale || snapshot.job?.status === "running" || snapshot.job?.status === "failed" || attempted.current === requestKey) return;
    attempted.current = requestKey;
    void ensureStats().catch(() => setRequestError({ key: errorKey, message: "Couldn't start your stats refresh. Please retry." }));
  }, [snapshot, stale, requestKey, errorKey, ensureStats]);
  const job = snapshot?.job;
  const running = job?.status === "running";
  const stalled = !!running && now - job.updatedAt >= 60_000;
  const phaseLabel = { movies: "reading movies", tv: "reading TV shows", episodes: "reading episode history", streaks: "calculating streaks", cleanup: "finishing" };
  let message = !snapshot ? "Loading your saved stats..." : snapshot.blocked ? "A data operation is in progress. Finish or resume it in Settings." :
    job?.status === "failed" ? "Stats refresh failed. Your previous snapshot is preserved. Retry to resume." :
    stalled ? "Stats refresh is waiting. Resume to continue from its checkpoint." :
    running ? `Refreshing: ${phaseLabel[job.phase as keyof typeof phaseLabel] ?? "in progress"}, ${job.processed} records read${job.restarts ? `, restarted ${job.restarts} time(s) after library edits` : ""}.` :
    stale ? "Snapshot is older than 24 hours. Refresh queued." : "Snapshot is up to date (refreshed within 24 hours).";
  if (currentError) message = currentError;
  async function refresh() {
    setRequestError(null); setRequesting(true);
    try { await refreshStats(); }
    catch { setRequestError({ key: errorKey, message: "Couldn't start your stats refresh. Please retry." }); }
    finally { setRequesting(false); }
  }
  return { data: snapshot?.stats ?? undefined, message, refresh, running, stalled,
    failed: !!currentError || job?.status === "failed", blocked: !!snapshot?.blocked,
    disabled: !snapshot || !!snapshot.blocked || requesting || (!!running && !stalled) };
}
