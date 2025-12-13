import { mutation, MutationCtx } from "./_generated/server";

async function calculateUserStats(db: MutationCtx["db"], userId: string) {
  const userMovies = await db
    .query("userMovies")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();

  const userTvSeries = await db
    .query("userTvSeries")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();

  const watchedEpisodes = await db
    .query("userEpisodes")
    .withIndex("by_user_watched", q => q.eq("userId", userId).eq("isWatched", true))
    .collect();

  const movieStats = {
    total: userMovies.length,
    watched: userMovies.filter(m => m.status === "watched").length,
    wantToWatch: userMovies.filter(m => m.status === "want_to_watch").length,
    onHold: userMovies.filter(m => m.status === "on_hold").length,
    dropped: userMovies.filter(m => m.status === "dropped").length,
  };

  const tvStats = {
    total: userTvSeries.length,
    watched: userTvSeries.filter(tv => tv.status === "watched").length,
    currentlyWatching: userTvSeries.filter(tv => tv.status === "currently_watching").length,
    wantToWatch: userTvSeries.filter(tv => tv.status === "want_to_watch").length,
    onHold: userTvSeries.filter(tv => tv.status === "on_hold").length,
    dropped: userTvSeries.filter(tv => tv.status === "dropped").length,
  };

  const episodeStats = {
    totalWatchedEpisodes: watchedEpisodes.length,
    totalWatchedSeasons: new Set(watchedEpisodes.map(e => e.seasonId)).size,
  };

  const totalMovieWatchTime = userMovies.reduce(
    (sum, m) => sum + (m.status === "watched" && m.runtime ? m.runtime : 0),
    0
  );

  const totalEpisodeWatchTime = watchedEpisodes.reduce(
    (sum, e) => sum + (e.runtime ? e.runtime : 0),
    0
  );

  const totalWatchTime = totalMovieWatchTime + totalEpisodeWatchTime;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const recentMovies = userMovies.filter(m => m.watchedDate && m.watchedDate > thirtyDaysAgo);

  const recentEpisodes = watchedEpisodes.filter(
    e => e.watchedDate && e.watchedDate > thirtyDaysAgo
  );

  const recentActivity = {
    moviesWatched: recentMovies.length,
    episodesWatched: recentEpisodes.length,
    totalItems: recentMovies.length + recentEpisodes.length,
  };

  const watchTimeBreakdown = {
    moviesMinutes: totalMovieWatchTime,
    episodesMinutes: totalEpisodeWatchTime,
    totalMinutes: totalWatchTime,
  };

  // Daily activity last 30 days
  const days: { date: string; movies: number; episodes: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, movies: 0, episodes: 0 });
  }

  const dayIndex = new Map(days.map((d, idx) => [d.date, idx]));

  for (const m of userMovies) {
    if (!m.watchedDate || m.status !== "watched") continue;
    const d = new Date(m.watchedDate);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].movies += 1;
  }

  for (const e of watchedEpisodes) {
    if (!e.watchedDate) continue;
    const d = new Date(e.watchedDate);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].episodes += 1;
  }

  const dailyActivity = days.map(d => ({ ...d, total: d.movies + d.episodes }));

  // Weekday distribution (0=Mon .. 6=Sun) aggregated over all activity
  const weekdayCounts: { weekday: number; movies: number; episodes: number }[] = Array.from(
    { length: 7 },
    (_, i) => ({ weekday: i, movies: 0, episodes: 0 })
  );

  for (const m of userMovies) {
    if (!m.watchedDate || m.status !== "watched") continue;
    const wd = new Date(m.watchedDate).getDay();
    weekdayCounts[wd].movies += 1;
  }
  for (const e of watchedEpisodes) {
    if (!e.watchedDate) continue;
    const wd = new Date(e.watchedDate).getDay();
    weekdayCounts[wd].episodes += 1;
  }
  const weekdayDistribution = weekdayCounts.map(w => ({
    weekday: w.weekday,
    movies: w.movies,
    episodes: w.episodes,
    total: w.movies + w.episodes,
  }));

  // Get longest streak
  const allActivityDates = new Set<string>();

  for (const m of userMovies) {
    if (m.watchedDate && m.status === "watched") {
      const d = new Date(m.watchedDate);
      d.setHours(0, 0, 0, 0);
      allActivityDates.add(d.toISOString().slice(0, 10));
    }
  }

  for (const e of watchedEpisodes) {
    if (e.watchedDate) {
      const d = new Date(e.watchedDate);
      d.setHours(0, 0, 0, 0);
      allActivityDates.add(d.toISOString().slice(0, 10));
    }
  }

  const sortedDates = Array.from(allActivityDates).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let prevTime: number | null = null;

  for (const dateStr of sortedDates) {
    const t = new Date(dateStr).getTime();
    if (prevTime === null || t - prevTime === dayMs) {
      currentStreak += 1;
    } else if (t - prevTime! > dayMs) {
      currentStreak = 1;
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    prevTime = t;
  }

  // Calculate current streak up to today (if last activity was today or yesterday contiguous)
  // (already handled by loop). To ensure currentStreak refers to last sequence ending at most
  // today- if gap since last date > 1 day, current streak should be 0
  if (prevTime && today.getTime() - prevTime > dayMs) {
    currentStreak = 0;
  }
  const streaks = { current: currentStreak, longest: longestStreak };

  const completionRates = {
    movies:
      movieStats.total - movieStats.wantToWatch
        ? movieStats.watched / (movieStats.total - movieStats.wantToWatch)
        : 100,
    tvSeries:
      tvStats.total - tvStats.wantToWatch
        ? tvStats.watched / (tvStats.total - tvStats.wantToWatch)
        : 100,
  };

  // Build weekly activity timeline (last 12 weeks)
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks: { label: string; start: number; end: number; movies: number; episodes: number }[] =
    [];

  for (let i = 11; i >= 0; i--) {
    const end = now - i * weekMs;
    const start = end - weekMs;
    const startDate = new Date(start);
    const label = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
    weeks.push({ label, start, end, movies: 0, episodes: 0 });
  }

  for (const m of userMovies) {
    if (!m.watchedDate) continue;
    for (const w of weeks) {
      if (m.watchedDate > w.start && m.watchedDate <= w.end) {
        if (m.status === "watched") w.movies += 1;
        break;
      }
    }
  }

  for (const e of watchedEpisodes) {
    if (!e.watchedDate) continue;
    for (const w of weeks) {
      if (e.watchedDate > w.start && e.watchedDate <= w.end) {
        w.episodes += 1;
        break;
      }
    }
  }

  const statusDistributionMovies = [
    { status: "Watched", value: movieStats.watched },
    { status: "Want to Watch", value: movieStats.wantToWatch },
    { status: "On Hold", value: movieStats.onHold },
    { status: "Dropped", value: movieStats.dropped },
  ];

  const statusDistributionTv = [
    { status: "Watched", value: tvStats.watched },
    { status: "Currently Watching", value: tvStats.currentlyWatching },
    { status: "Want to Watch", value: tvStats.wantToWatch },
    { status: "On Hold", value: tvStats.onHold },
    { status: "Dropped", value: tvStats.dropped },
  ];

  return {
    overview: {
      totalStartedMovies: movieStats.total - movieStats.wantToWatch,
      totalStartedTvSeries: tvStats.total - tvStats.wantToWatch,
      totalWatchedMovies: movieStats.watched,
      totalWatchedTvSeries: tvStats.watched,
      totalWatchedEpisodes: episodeStats.totalWatchedEpisodes,
      totalWatchedSeasons: episodeStats.totalWatchedSeasons,
      totalWatchTimeMinutes: totalWatchTime,
      totalWatchTimeHours: Math.round(totalWatchTime / 60),
    },
    distributions: {
      movies: statusDistributionMovies,
      tvSeries: statusDistributionTv,
    },
    weeklyActivity: weeks,
    dailyActivity,
    weekdayDistribution,
    watchTimeBreakdown,
    streaks,
    completionRates,
    movies: movieStats,
    tvSeries: tvStats,
    episodes: episodeStats,
    recentActivity,
    generatedAt: now,
  };
}

export const getUserStats = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    const userId = identity.subject;

    // Try to get cached stats
    const cached = await ctx.db
      .query("userStats")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();

    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // If cache exists and is less than 24 hours old, return it
    if (cached && now - cached.lastRefreshed < oneDayMs) {
      return cached.stats;
    }

    // If cache is stale or missing, calculate fresh stats
    const stats = await calculateUserStats(ctx.db, userId);

    // Update or insert the cache
    if (cached) {
      await ctx.db.patch(cached._id, { stats, lastRefreshed: now });
    } else {
      await ctx.db.insert("userStats", { userId, stats, lastRefreshed: now });
    }

    return stats;
  },
});

export const refreshStats = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    const userId = identity.subject;

    const stats = await calculateUserStats(ctx.db, userId);

    const existing = await ctx.db
      .query("userStats")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { stats, lastRefreshed: Date.now() });
    } else {
      await ctx.db.insert("userStats", { userId, stats, lastRefreshed: Date.now() });
    }

    return stats;
  },
});
