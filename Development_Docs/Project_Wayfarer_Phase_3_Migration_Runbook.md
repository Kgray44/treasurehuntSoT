# Phase 3 Migration Runbook

Apply SQLite migrations `20260725110000_wayfarer_chronicle_history` and
`20260725111000_wayfarer_chronicle_crew_consent`; apply matching MySQL scripts
`0025` and `0026` after the current Phase 2 inventory. Back up first; rehearse
against an isolated empty/current-schema database; run foreign-key checks; then
run bounded idempotent reconciliation. A failed batch may be retried because
`(playerProfileId, sourcePlaythroughId)` is unique. There is no Phase 3
destructive removal. Verify source-table hashes before and after projection and
retain backups for rollback/restore.

Acceptance evidence on 2026-07-25: Prisma 6.19.3 under Node 22.13.0 applied
all 27 SQLite migrations, including both Phase 3 migrations, to a fresh local
database. The schema engine binary was executable and both `db push` and
`migrate deploy` succeeded. Earlier generic command output was caused by Prisma
CLI debug stderr and optional per-user command-state-file logging, not a schema
engine or migration failure.
