# Backup and deletion operations

Backups remain `couchlist.export`, version 1. The browser assembles the downloadable JSON from authenticated pages of at most 100 records. It never sends or receives the complete library as a Convex array. Download assembly and file parsing still use browser memory.

Imports validate the complete file in the browser, then validate and stage bounded batches on the server. Duplicate identities are checked across batches. The server will not seal an incomplete upload. Upload retries must match the existing records exactly; reselecting the same file resumes from the acknowledged offset. Inactive preparations expire after 24 hours and can be discarded without changing library data.

Sealing starts a durable, scheduled job. Each transaction records its cursor and revision together with its writes and next continuation. A failed batch rolls back, records an error, and can be resumed from Settings. Stale or duplicate continuations do nothing. A sealed operation cannot be cancelled: recovery rolls forward using the staged data, without needing the original file.

Replacement first applies the staged backup, then prunes records absent from that backup. It never deletes the old library before the incoming records are durably staged. Temporary mixed data and partially rebuilt summaries may be visible while the operation runs; Settings reports completion only after pruning, paginated summary rebuilding, stats invalidation, and staging cleanup finish. The old atomic visibility guarantee is replaced by explicit progress and durable recovery.

One account-wide operation runs at a time. All normal movie, episode, series, and stats mutations read the same operation fence in their transaction and refuse writes until completion. Export uses the same fence for a consistent multi-page snapshot. Other accounts continue independently. Administrative internal migrations must not run concurrently with an operation; the unsafe user-ID migration is now internal and is not used by these jobs.

Summary rebuilding scans episodes in series order across bounded pages, including moved episodes' old parents, unknown watch dates, and orphan watched histories. Version 1 series dates are compatibility metadata, not watch evidence. The legacy optional season-count object cannot represent more than 1,024 distinct watched seasons on a single show: that exceptional case uses the existing unknown-count UI fallback rather than returning incorrect truncated counts. Dates remain complete, and all episode records remain in the backup.

Clear-movies, clear-TV, single-series deletion, and account cleanup are also scheduled batches. The account route retains its origin, authentication, and recent-authentication checks. It returns HTTP 202 until all Convex library, stats, and staging data is gone, then calls WorkOS. WorkOS failures are retryable; an already-removed identity (404) counts as success. A minimal account-deletion fence containing the owner subject and operation counters remains to prevent data resurrection by still-valid JWTs. It contains no backup payload or watch history.

Deployment requires the new `dataOperations` and `dataImportRows` tables and their indexes, plus the matching frontend and backend APIs. Existing library tables need no backfill or data migration. The old whole-payload import API is removed; old open clients should reload. This implementation was verified locally without deploying or touching any live account.

Validation commands:

```sh
bunx vitest run
bun test tests
bun run typecheck
bun run build
```

The Convex tests use `convex-test` with enforced transaction limits stricter than production, including a positive control proving the index-range budget rejects excess reads. They exercise 4,097-record ingestion, 8,301-episode downloadable backups, checkpoints, retries, invalid replacements, summary pages, deletion, authorization, and scheduled execution. Account-route tests mock Convex and WorkOS and verify completion ordering and authentication gates. They are isolated tests, not a claim of production latency or end-to-end WorkOS integration coverage.
