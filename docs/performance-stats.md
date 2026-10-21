# Stats snapshots and bounded rebuilds

`stats.getUserStats` is an authenticated query over three owner-indexed rows:
the existing `userStats` snapshot, current stats checkpoint, and data-operation
fence. It never reads library history, writes, schedules, or checks the clock.
The authenticated layout keeps its subscription mounted across route visits.
It is keyed to the WorkOS account and skipped/hidden until Convex authenticates.
Only visiting Stats requests a missing/stale snapshot. Manual refresh bypasses
the 24-hour TTL. Both triggers converge on the same active checkpoint.

Each scheduled pass reads at most 64 source rows (also limited to 256 KiB per
page, allowing a final document to cross the native byte threshold), accumulates
fixed 30-day/12-week/7-weekday windows, and records unique
days/seasons in individual `statsFacts` rows. The day index streams streaks in
pages; cleanup also deletes in pages before publishing. No final history scan,
growing job array/map, or history payload crosses a function boundary. Scheduled
arguments contain only a checkpoint ID and revision; worker returns are null.

The worker uses Convex 1.43 nested transaction limits: 512 documents read, 256
indexed ranges, 192 documents written, 4 MiB read, 1 MiB written, one scheduled
function and 1 KiB of scheduled arguments. The outer mutation retains headroom
to persist a failed checkpoint after the nested transaction rolls back. A retry
continues that checkpoint. A 60-second lease lets a user resume a lost callback;
revision checks make duplicate or late callbacks inert. Prior snapshots survive
both refreshes and failures.

Every normal library writer passes through `assertDataWritable`, which marks an
active stats pass dirty in the same transaction as the edit. A dirty pass cleans
its scratch, resets its fixed accumulator/reference time, and restarts before
publishing. Publication conflicts transactionally with edits to that checkpoint.
Thus a published result describes a pass with no intervening relevant edits;
ongoing edits can postpone completion. Completed snapshots retain the existing
24-hour cache policy; subsequent edits do not force immediate recomputation.

All windows use the pass's captured UTC reference time. Existing metric semantics
are retained, including recent movies' retained dates regardless of status,
Sunday=0 weekday numbers, missing/zero dates excluded from dated activity, and
the legacy empty completion-rate value of 100. Watch counts/runtime still include
watched entries with unknown dates. Streak dates are deduplicated across movies
and episodes, with gaps resetting the run and today/yesterday retaining it.

Starting an import, clear, series deletion, repair or export deletes the stats
checkpoint in the same transaction as acquiring the existing operation fence.
Old callbacks cannot publish or recreate it. Cancelled scratch is collected in
bounded background calls. The new `delete_stats_work` operation phase additionally
removes all owner-scoped scratch before completing clear/import/account cleanup,
including operations already in flight at rollout. Account deletion immediately
hides the snapshot and retains its existing `awaiting_identity` tombstone, which
blocks stats recreation even with a still-valid JWT.

## Rollout

- Additive schema changes introduce only `statsRebuilds`, `statsFacts`, their
  indexes on initially empty tables, and a data-operation phase. Existing source
  indexes, source documents, cached snapshots and operation cursors stay valid.
  No data migration or backfill is required.
- Release schema/functions and frontend together: `getUserStats` changes from a
  mutation to a query, and refresh returns a job ID. Reload already-open Stats
  pages after release. Do not roll back the new operation-phase validator while
  an operation is in `delete_stats_work`; finish it first.
- Verification is local/in-memory only. No shared Convex deployment or real user
  data was changed. Generated API types were updated locally; a deployment still
  needs the normal release process and its schema/function validation.

## Verification

`bunx vitest run convex/stats.test.ts hooks/stats-snapshot.test.tsx` exercises
cached reads, TTL/manual triggers, tab deduplication, checkpoint retries and stale
callbacks, metric boundaries, unknown/empty histories, edit restarts, and data
operations. Separate fixtures use 8,301 episodes and 1,030 distinct days/seasons
(exceeding the array and object limits without multiplying the harness's
in-memory index-scan cost). They enforce real convex-test
read/query/write/byte/scheduler budgets, measure every
worker transaction, and caps serialized checkpoint size. Negative controls prove
that unbounded reads and excessive indexed ranges are rejected by that harness.
These are transaction-work measurements, not production latency measurements.
The cached query is tested with three document/range reads and zero writes or
scheduling. Both stress fixtures assert at most 200 documents read, 140 indexed
ranges and 130 documents written per worker transaction, with checkpoint JSON
below 16 KiB and scheduled arguments below 1 KiB.

The provider tests check retained route visits without an empty render or new
mutation, auth/account changes, progress/failure/completion, and stalled resumes.
Project validation uses `bun run test`, `bun run typecheck` (both frontend and
backend), and `bun run build`. The build uses a loopback Convex URL and does not
connect to a deployment.
