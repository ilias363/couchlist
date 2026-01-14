"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBatchTMDBTvSeries } from "@/lib/tmdb/react-query";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

const TMDB_STATUSES = [
  "All",
  "Returning Series",
  "Ended",
  "Canceled",
  "In Production",
  "Planned",
  "Pilot",
];

export default function TvStatusPage() {
  const [watchStatusFilter, setWatchStatusFilter] = useState<string>("all");
  const [tmdbStatusFilter, setTmdbStatusFilter] = useState<string>("All");

  // Get all user's TV series
  const allSeries = useQuery(api.tv.listAllTvStatuses);
  const seriesIds = allSeries ? Object.keys(allSeries).map(Number) : [];

  // Fetch TMDB details for all series
  const { map: detailsMap, isLoading: loading } = useBatchTMDBTvSeries(seriesIds);

  // Combine and filter data
  const tableData = (() => {
    if (!allSeries) return [];

    return seriesIds
      .map(id => {
        const userStatus = allSeries[id]?.status || "unknown";
        const details = detailsMap.get(id);
        return {
          id,
          name: details?.name || `Series #${id}`,
          userStatus,
          userStatusLabel: WATCH_STATUSES.find(s => s.value === userStatus)?.label || userStatus,
          tmdbStatus: details?.status || "Loading...",
          posterPath: details?.poster_path,
        };
      })
      .filter(item => {
        // Filter by user watch status
        if (watchStatusFilter !== "all" && item.userStatus !== watchStatusFilter) {
          return false;
        }
        // Filter by TMDB status
        if (tmdbStatusFilter !== "All" && item.tmdbStatus !== tmdbStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Calculate stats
  const stats = (() => {
    if (!allSeries) return null;

    const all = seriesIds.map(id => ({
      userStatus: allSeries[id]?.status,
      tmdbStatus: detailsMap.get(id)?.status,
    }));

    const byTmdbStatus: Record<string, number> = {};
    for (const item of all) {
      const status = item.tmdbStatus || "Unknown";
      byTmdbStatus[status] = (byTmdbStatus[status] || 0) + 1;
    }

    return { byTmdbStatus, total: all.length };
  })();

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/tv-series">
          <Button variant="ghost" size="sm" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">TV Status Overview</h1>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            View your TV series with their TMDB production status
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="p-3 sm:p-4 rounded-lg border bg-card">
          <h3 className="font-medium mb-2 text-sm sm:text-base">TMDB Status Distribution</h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {Object.entries(stats.byTmdbStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <span
                  key={status}
                  className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                    status === "Returning Series"
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : status === "Ended"
                      ? "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                      : status === "Canceled"
                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                      : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {status}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 sm:flex-initial">
          <label className="block text-xs sm:text-sm font-medium mb-1">My Watch Status</label>
          <select
            value={watchStatusFilter}
            onChange={e => setWatchStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-md border bg-background text-sm"
          >
            <option value="all">All Statuses</option>
            {WATCH_STATUSES.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 sm:flex-initial">
          <label className="block text-xs sm:text-sm font-medium mb-1">TMDB Status</label>
          <select
            value={tmdbStatusFilter}
            onChange={e => setTmdbStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-md border bg-background text-sm"
          >
            {TMDB_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading || !allSeries ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Series Name</th>
                  <th className="px-4 py-3 text-left font-medium">My Status</th>
                  <th className="px-4 py-3 text-left font-medium">TMDB Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No series found with the selected filters.
                    </td>
                  </tr>
                ) : (
                  tableData.map(item => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/tv-series/${item.id}`}
                          className="hover:underline font-medium"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            item.userStatus === "watched"
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : item.userStatus === "currently_watching"
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : item.userStatus === "up_to_date"
                              ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                              : item.userStatus === "want_to_watch"
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                              : item.userStatus === "on_hold"
                              ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                              : "bg-red-500/20 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {item.userStatusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            item.tmdbStatus === "Returning Series"
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : item.tmdbStatus === "Ended"
                              ? "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                              : item.tmdbStatus === "Canceled"
                              ? "bg-red-500/20 text-red-600 dark:text-red-400"
                              : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {item.tmdbStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tv-series/${item.id}`}
                          className="text-primary hover:underline text-xs"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-muted/30 text-sm text-muted-foreground">
              Showing {tableData.length} of {seriesIds.length} series
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {tableData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No series found with the selected filters.
              </div>
            ) : (
              tableData.map(item => (
                <Link
                  key={item.id}
                  href={`/tv-series/${item.id}`}
                  className="group block p-3 rounded-lg border bg-card hover:bg-muted/30 hover:border-primary/50 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium group-hover:text-primary transition-colors">
                      {item.name}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.userStatus === "watched"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : item.userStatus === "currently_watching"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : item.userStatus === "up_to_date"
                          ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                          : item.userStatus === "want_to_watch"
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : item.userStatus === "on_hold"
                          ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                          : "bg-red-500/20 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {item.userStatusLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.tmdbStatus === "Returning Series"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : item.tmdbStatus === "Ended"
                          ? "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                          : item.tmdbStatus === "Canceled"
                          ? "bg-red-500/20 text-red-600 dark:text-red-400"
                          : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {item.tmdbStatus}
                    </span>
                  </div>
                </Link>
              ))
            )}
            <div className="text-center text-xs text-muted-foreground pt-2">
              Showing {tableData.length} of {seriesIds.length} series
            </div>
          </div>
        </>
      )}
    </div>
  );
}
