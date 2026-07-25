# Phase 3 Migration Runbook

Apply SQLite migration `20260725110000_wayfarer_chronicle_history` and MySQL
script `0025_wayfarer_chronicle_history` after the current Phase 2 inventory.
Back up first; rehearse against an isolated empty/current-schema database; run
foreign-key checks; then run bounded idempotent reconciliation. A failed batch
may be retried because `(playerProfileId, sourcePlaythroughId)` is unique.
There is no Phase 3 destructive removal. Verify source-table hashes before and
after projection and retain backups for rollback/restore.
