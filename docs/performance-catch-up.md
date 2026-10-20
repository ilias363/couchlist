# Catch-up performance: audit issue 3

Catch-up now reads indexed pages of show summaries (25 in the UI, at most 50
per backend call), with explicit 50-row/512-KiB pagination read budgets even
when a reactive cursor range grows. It does not scan episode history. A season needs checking
when verified completeness evidence is absent, its watched count or TMDB season
metadata changes, or airing metadata cannot confirm completion. Finished,
previously verified regular seasons are skipped even
for Returning Series. Future seasons use series metadata directly. Specials
remain excluded.

Candidate comparisons request only current aired/undated episode IDs, in chunks
of at most 100. Each lookup checks the authenticated account, series, season and
watched flag. Private results stay in Convex subscriptions; only public TMDB
metadata uses the existing shared React Query and Next caches.

A bounded optional map on each tracked show records verified completeness,
not TMDB episode inventories. Before saving it, a mutation atomically rechecks
at most 100 supplied episode IDs. Each map holds at most 100 seasons. Watch
changes invalidate evidence for affected seasons; imports clear it. Count
equality alone is never enough to skip: a downward TMDB count revision can
otherwise remove a watched episode while leaving an older unwatched gap.
Observed metadata contradictions revoke the exact saved evidence, so a count
that later returns to its old value cannot revive it. The hook also rejects
that evidence while revocation is pending or fails; stale revocations leave
changed verification values intact.
Seasons with more than 100 episodes and seasons beyond the first 100 regular
seasons keep bounded comparison reads without persisting completeness evidence.

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
While an import or TV-data operation is applying/rebuilding, catch-up hides
transitional results and announces that the library is being updated. Its
backend list also withholds summary shortcuts. Explicit watched-ID retries
change a validated query argument so Convex starts a fresh transport query.
Only failed subscriptions change arguments; successful cards remain visible
while another show's watched-ID check retries.

## Local evidence

- A real-hook/shared-cache fixture with 25 returning shows, eight watched
  seasons each and saved completeness evidence makes 25 cold transport calls: series details only, zero season
  calls or watched-ID comparisons. A warm remount adds zero transport calls.
  The audit's 225-request example was a derivation, not observed traffic.
- Without evidence, the first verification of that fixture makes 225 mocked
  transport calls and saves 25 bounded proof batches. A later cold cache makes
  25 calls, and a warm remount adds zero. This one-time bootstrap is necessary
  to distinguish a matching count from an actually completed inventory.
- An older gap checks one season, retaining completed history in its totals.
  A revised episode count refreshes that season without fetching other seasons.
- `convex-test` with 2,000 historical episode rows measures 25 documents and two
  indexed queries for a 25-show page (including its readiness fence). A completed
  operation row adds one document. A 100-ID comparison measures 100 documents
  and 100 indexed point queries. Tests enforce transaction read budgets.
- A 100-ID proof write with an existing completed operation reads 103 documents
  using 102 indexed queries, including the series/operation rows and patch read.
  Proof storage is capped at 100 season entries.
- Revoking up to 100 saved season proofs uses one indexed show lookup, with
  two document reads including the patch read and no episode-history reads.
- Regression checks cover gaps, new content, count revisions, future/unknown
  dates, legacy summaries, large seasons, pagination, progressive rendering,
  failures/retry, cancellation, viewport deferral and account isolation.
  New checks exercise real import batches between summary resets, same-time
  watch changes, count decreases, and the installed Convex observer/sync-state
  subscription deduplication rather than only a mocked retry.
  Follow-up regressions cover `10 → 11 → 10` metadata revisions, failed
  revocation, successful-card retention during retry, and version 1 exports
  after completeness evidence has been saved.

These are deterministic local fixtures. No production latency or speedup was
measured. Verification uses Vitest, `bun test tests --timeout 30000`, app and
Convex typechecks, ESLint and a production build with placeholder configuration.

## Compatibility

An optional schema field stores completeness evidence; no new index or manual
backfill is needed. Missing summaries/evidence fall back to bounded candidate-ID
checks and the first verification populates evidence automatically. Metadata
keeps the existing five-minute freshness window. Same-count TMDB inventory
replacements cannot be detected from series-level metadata alone.
Derived completeness evidence is excluded from version 1 backup exports,
alongside watched-count summaries; the backup format is unchanged.
Roll out the new backend queries with the updated frontend; older clients using
the removed full-history query need to reload. Routine mutation logic remains
unchanged except for targeted completeness-evidence invalidation in the existing
summary helper/status write and clearing evidence during import summary reset.
Incremental summary maintenance remains with audit issue 4.
No shared deployment or real user data was changed during verification.
