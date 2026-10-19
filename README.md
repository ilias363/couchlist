## CouchList

Track what you watch across movies and TV series. Browse trending/popular titles from TMDB, search, set per-item watch status, mark episodes watched, view rich personal stats, and back up or restore your tracking data.

### Highlights
- Authenticated app with WorkOS AuthKit; public landing page at `/`
- Movies and TV tracking with statuses: Want to Watch, Currently Watching (TV), Watched, On Hold, Dropped
- Episode-level tracking with bulk mark/unmark for a season
- Episode ratings drawer on TV series pages, with SeriesGraph embedded in the app
- Home feed: Trending, Popular, Top Rated, Now Playing/Airing Today
- Search (movie, TV, or both) with infinite scrolling
- Stats dashboard: distributions, daily/weekly activity, streaks, and watch-time breakdown
- Backup & restore: export/import your tracked data from Settings
- Built with Next.js App Router, Convex, and TanStack Query

## Tech Stack
- Next.js 15 (App Router) + React 19
- Authentication: WorkOS AuthKit
- Data & backend: Convex (queries/mutations, document DB)
- Data fetching/cache: TanStack Query
- UI: Tailwind CSS v4, custom shadcn-style components, lucide-react icons
- Charts: Chart.js + react-chartjs-2
- TMDB API for metadata and posters/backdrops

## Architecture Overview
- Frontend (Next.js):
	- Auth gating via `middleware.ts` (all routes require auth except `/`).
	- Providers in `app/layout.tsx`: ThemeProvider, ConvexClientProvider, React Query provider.
	- Pages under `app/(authenticated)/…`: `home`, `search`, `movies`, `tv-series`, `stats`.
- Backend (Convex):
	- `convex/schema.ts`: tables for `userMovies`, `userTvSeries`, `userEpisodes` with indexes for status and recency.
	- `convex/movie.ts`, `convex/tv.ts`: queries/mutations to set/get statuses and paginate user libraries; episode toggles and season bulk operations.
	- `convex/stats.ts`: computes watch-time, distributions, daily/weekly charts, and streaks.
- TMDB integration (`lib/tmdb/*`): strongly-typed client and React Query hooks for search, details, seasons, and categories; image helpers.

## Environment Variables
Copy `.env.example` to `.env.local` and fill values.

See `.env.example` for placeholders and notes.

Set `TMDB_API_KEY` in the Next.js server environment. Browser requests use the authenticated `/api/tmdb/*` route; only the server contacts TMDB with the key. The route allows the metadata endpoints used by the app and caches upstream responses for five minutes. No rate limiting is configured.

When upgrading from `NEXT_PUBLIC_TMDB_API_KEY`, rename it to `TMDB_API_KEY` locally and in your hosting environment, remove the public variable, and rebuild/redeploy. Rotate the previously exposed key in TMDB and set the replacement as `TMDB_API_KEY`; old browser bundles can still contain the old key.

## Local Development
Prerequisites: Node 22.11+, bun, a WorkOS AuthKit environment, a TMDB API key, and the Convex CLI.

1) Install dependencies
- bun install

2) Configure env
- Copy `.env.example` to `.env.local` and fill all values.

3) Start Convex (separate terminal)
- npx convex dev
- Note the printed Convex URL and set it as `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

4) Run the Next.js app
- bun dev
- Open http://localhost:3000

Sign-in is handled by WorkOS AuthKit. The proxy protects all routes except the landing and authentication routes.

## Scripts
- dev: Start Next.js (Turbopack)
- build: Build Next.js (Turbopack)
- start: Start production server
- lint: ESLint
- typecheck: TypeScript project check

## Directory Structure (short)
```
app/
	(authenticated)/home | movies | movies/[tmdbId] | tv-series | tv-series/[tmdbId]/season/[seasonNumber] | search | stats
components/
	ui/… (buttons, cards, sidebar, skeleton, etc)
	tmdb-image.tsx, media-card.tsx, status-selector.tsx, media-carousel.tsx
convex/
	schema.ts, movie.ts, tv.ts, stats.ts, auth.config.ts
lib/
	tmdb/ (client-api, react-query, types, utils)
```

## Data Model (Convex)
- userMovies: { userId, movieId, status, runtime?, watchedDate?, createdAt, updatedAt }
- userTvSeries: { userId, tvSeriesId, status, startedAt?, lastWatchedAt?, seasonWatchedCounts?, createdAt, updatedAt }
- userEpisodes: { userId, tvSeriesId, seasonId, episodeId, isWatched, runtime?, watchedDate?, createdAt, updatedAt }

Common statuses: want_to_watch | currently_watching (TV only) | watched | on_hold | dropped

## Stats Caching
Stats are cached in the `userStats` table to reduce compute usage.
- **Default Behavior**: Stats are served from the cache if less than 24 hours old. Otherwise, they are calculated on-the-fly.
- **Manual Refresh**: Users can manually refresh stats via the "Refresh Stats" button in the UI to update the cache.
- **Automatic Refresh**: When stats are requested and the cache is older than 24 hours, fresh stats are calculated automatically.

## Deployment
Refer to [Convex deployment docs](https://docs.convex.dev/production/hosting/) and [WorkOS environment docs](https://workos.com/docs/authkit/environments).

Episode updates maintain season counts and date boundaries in the same transaction as the episode writes. Removing/changing a boundary uses at most two indexed episode lookups; status-only edits preserve the summary. Season and whole-series actions send sequential batches of at most 100 episodes. The server rejects larger requests, so ship the updated clients with this backend and reload older open tabs before actions on more than 100 episodes. Successful batches remain committed if a later batch fails, so retry the action to finish; bulk watching preserves dates on already-watched episodes. Each batch is atomic, while a whole-series action can interleave with other tabs between batches.

For incremental-summary rollout, prepare the date index **before** enabling the new handlers. First deploy only the new optional schema fields/operation kind and the `by_userId_tvSeriesId_isWatched_watchedDate` index with `{ fields: ["userId", "tvSeriesId", "isWatched", "watchedDate"], staged: true }`, keeping the previous handlers. Wait for backfill in the Convex dashboard, then deploy this code with the index enabled (no `staged: true`). Do not query a staged index. A direct deployment of the final schema also builds the index but can block on a large episode table. These steps require separate deployment authorization; local tests do not push schema or run repairs.

Existing populated count maps remain usable without backfill. A legacy series with history and no count map requires explicit repair before episode edits; status edits still preserve its dates and unknown progress. An empty-history probe can safely initialize an empty summary. For one series (including an orphaned history), an operator can run `migrations:repairTvSeriesDates` with `{ "userId": "<stored account subject>", "tvSeriesId": 123 }` through the Convex CLI/dashboard. This internal mutation now returns a **data-operation job ID**, replacing the old synchronous repair result. It queues 100-row batches, pauses account writes, preserves series status/library timestamps, and checks duplicate episode/parent identities. Read `dataOperations:status` as the owner or check Settings for completion. Failed batches retain their checkpoint/fence; reconcile the reported identity problem and use Settings → Resume. Do not cancel or delete a partially applied job.

To backfill missing summaries for existing parent rows, an operator can run `bunx convex run migrations:backfillSeasonWatchedCounts` against the explicitly selected deployment. It discovers one series at a time, skips populated/repaired summaries, and waits for each bounded repair to complete before scheduling the next discovery. It returns `running_in_background` until all work finishes; only the final discovery logs `Season watched-count backfill completed.` A paused repair must be resumed in Settings. If discovery encounters another active account operation, finish that operation and restart discovery from its reported cursor (or rerun from the beginning; completed summaries are skipped). Read-only `preflightTvSeriesDates` still scans candidate histories and is an explicit diagnostic, not a routine update or the bounded repair path.

Import/replace retains its existing account fence and bounded reset/finalization passes, including moved episodes and absent parents. Version-1 backups omit the internal summary marker. Counts exceeding Convex's 1024-field object limit remain unknown, with a marker distinguishing them from legacy summaries; dates continue to update incrementally. Explicit repair restores counts once the map fits again. For the independent catch-up change, keep both branches' localized edits in `convex/tv.ts` and any new indexes in `convex/schema.ts`; this change does not alter the catch-up query/request algorithm.

## Install as an app
Following the [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), `app/manifest.ts` enables installation with CouchList icons and a standalone window.

Opening the installed icon starts at `/launch`, which restores the last app path and query parameters saved on this device for the signed-in account. First launches, invalid saved paths, and unavailable browser storage fall back to `/home`. Direct links and normal browser visits keep their requested destination. Scroll position and unsaved form state are not restored.

Serve the app over HTTPS in production (localhost works for development). Use the browser's Install app option where supported; on iPhone or iPad, use Safari's Share menu and Add to Home Screen.

The app still requires an internet connection. There is no service worker, offline cache, push notification setup.

## Attribution
This product uses the TMDB API but is not endorsed or certified by TMDB.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
