# Project Wayfarer Phase 2 Migration Runbook

Apply after the Phase 1 cross-project chain: SQLite `20260722120000`, then `20260722121000`; MySQL `0013`, `0014`, then `0015`. Use only a disposable database for rehearsal. Capture profile/community counts before and after, run the typed V1 reconciliation, inspect handle conflicts rather than auto-merging, and run `PRAGMA foreign_key_check` for SQLite.

The migration is additive: no Phase 1 field, Community record, session, invitation, Chronicle, or private package is deleted. Production MySQL remains NO-GO pending backup, owner approval, and a live isolated rehearsal.
