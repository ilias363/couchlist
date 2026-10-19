# Catch-up performance: audit issue 3

Catch-up now reads indexed pages of show summaries (25 in the UI, at most 50
per backend call), with explicit 50-row/512-KiB pagination read budgets even
when a reactive cursor range grows. It does not scan episode history. A season needs checking
when its watched count differs, its summary is absent, or airing metadata cannot
confirm completion. Finished, fully watched regular seasons are skipped even
for Returning Series. Future seasons use series metadata directly. Specials
remain excluded.

Candidate comparisons request only current aired/undated episode IDs, in chunks
of at most 100. Each lookup checks the authenticated account, series, season and
watched flag. Private results stay in Convex subscriptions; only public TMDB
metadata uses the existing shared React Query and Next caches.

The existing TMDB transport caps in-flight requests at six, removes cancelled
queued work, and forwards active cancellation through the authenticated proxy
to TMDB. Upstream requests time out after 15 seconds. Catch-up retries metadata
once. A fresh series count revision refreshes a mismatching cached season.

Completed shows render immediately in the original order (unwatched count,
then name). Loading, failed and unrequested pages keep totals explicitly partial.
Final totals and the caught-up message require successful completion of every
page. The home carousel still activates within 200px of the viewport; it checks
the first 25 recent shows and links to the full paginated checks. Unknown dates
stay visible and are excluded from aired totals. Future episodes remain visible
even when all aired episodes have been watched.

## Local evidence

- A real-hook/shared-cache fixture with 25 returning shows and eight watched
  seasons each makes 25 cold transport calls: series details only, zero season
  calls or watched-ID comparisons. A warm remount adds zero transport calls.
  The audit's 225-request example was a derivation, not observed traffic.
- An older gap checks one season, retaining completed history in its totals.
  A revised episode count refreshes that season without fetching other seasons.
- `convex-test` with 2,000 historical episode rows measures 25 documents and one
  indexed query for a 25-show page. A 100-ID comparison measures 100 documents
  and 100 indexed point queries. Tests enforce transaction read budgets.
- Regression checks cover gaps, new content, count revisions, future/unknown
  dates, legacy summaries, large seasons, pagination, progressive rendering,
  failures/retry, cancellation, viewport deferral and account isolation.

These are deterministic local fixtures. No production latency or speedup was
measured. Verification uses Vitest, `bun test tests --timeout 30000`, app and
Convex typechecks, ESLint and a production build with placeholder configuration.

## Compatibility

No schema/index migration is needed. Missing summaries fall back to bounded
candidate-ID checks, with more cold season requests until summaries exist.
Skipping a completed season trusts its matching per-season summary and TMDB's
last-aired metadata; metadata keeps the existing five-minute freshness window.
Roll out the new backend queries with the updated frontend; older clients using
the removed full-history query need to reload. Routine status/episode mutation
paths are unchanged, leaving incremental summary maintenance to audit issue 4.
No shared deployment or real user data was changed during verification.
