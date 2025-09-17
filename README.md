## CouchList

Track what you watch across movies and TV series. Browse trending/popular titles from TMDB, search, set per-item watch status, mark episodes watched, view rich personal stats, and back up or restore your tracking data.

### Highlights
- Authenticated app with Clerk; public landing page at `/`
- Movies and TV tracking with statuses: Want to Watch, Currently Watching (TV), Watched, On Hold, Dropped
- Episode-level tracking with bulk mark/unmark for a season
- Home feed: Trending, Popular, Top Rated, Now Playing/Airing Today
- Search (movie, TV, or both) with infinite scrolling
- Stats dashboard: distributions, daily/weekly activity, streaks, and watch-time breakdown
- Backup & restore: export/import your tracked data from Settings
- Built with Next.js App Router, Convex, and TanStack Query

## Tech Stack
- Next.js 15 (App Router) + React 19
- Authentication: Clerk
- Data & backend: Convex (queries/mutations, document DB)
- Data fetching/cache: TanStack Query
- UI: Tailwind CSS v4, custom shadcn-style components, lucide-react icons
- Charts: Chart.js + react-chartjs-2
- TMDB API for metadata and posters/backdrops

## Architecture Overview
- Frontend (Next.js):
	- Auth gating via `middleware.ts` (all routes require auth except `/`).
	- Providers in `app/layout.tsx`: ThemeProvider, ClerkProvider, ConvexClientProvider, React Query provider.
	- Pages under `app/(authenticated)/…`: `home`, `search`, `movies`, `tv-series`, `stats`.
- Backend (Convex):
	- `convex/schema.ts`: tables for `userMovies`, `userTvSeries`, `userEpisodes` with indexes for status and recency.
	- `convex/movie.ts`, `convex/tv.ts`: queries/mutations to set/get statuses and paginate user libraries; episode toggles and season bulk operations.
	- `convex/stats.ts`: computes watch-time, distributions, daily/weekly charts, and streaks.
- TMDB integration (`lib/tmdb/*`): strongly-typed client and React Query hooks for search, details, seasons, and categories; image helpers.

## Environment Variables
Copy `.env.example` to `.env.local` and fill values.

See `.env.example` for placeholders and notes.

## Local Development
Prerequisites: Node 18+, pnpm, a Clerk app, a TMDB API key, and the Convex CLI.

1) Install dependencies
- pnpm install

2) Configure env
- Copy `.env.example` to `.env.local` and fill all values.

3) Start Convex (separate terminal)
- npx convex dev
- Note the printed Convex URL and set it as `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

4) Run the Next.js app
- pnpm dev
- Open http://localhost:3000

Sign-in is handled by Clerk. The middleware protects all routes except `/`.

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
- userTvSeries: { userId, tvSeriesId, status, startedDate?, watchedDate?, createdAt, updatedAt }
- userEpisodes: { userId, tvSeriesId, seasonId, episodeId, isWatched, runtime?, watchedDate?, createdAt, updatedAt }

Common statuses: want_to_watch | currently_watching (TV only) | watched | on_hold | dropped

## Deployment
Refer to [Convex deployment docs](https://docs.convex.dev/production/hosting/) and [Clerk deployment docs](https://clerk.com/docs/deployments/overview).

## Attribution
This product uses the TMDB API but is not endorsed or certified by TMDB.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
