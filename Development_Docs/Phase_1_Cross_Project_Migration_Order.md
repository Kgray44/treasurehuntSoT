# Phase 1 Cross-Project Migration Order

The migration ledger records directory names and file checksums; SQLite applies lexical timestamp directories and MySQL uses the checked-in numeric directories/scripts. Candidate migration use is limited to disposable validation databases. Collision reconciliation is complete: One Voyage is `0005`, Wayfarer `0006`, Sealed Hold `0007`, cross-project ownership `0008`, and Harborlight `0009`/`0010`.

Do not apply this sequence to a production database. Each environment requires a backup, a fresh-schema rehearsal, checksum capture, and a bounded reconciliation report first.

1. Apply One Voyage, including the `Chronicle` to `Chronicle` physical-table rename.
2. Apply Wayfarer account tables and nullable Player linkage.
3. Run deterministic identity/actor backfill; record collisions and leave ambiguous matches unresolved.
4. Apply Sealed Hold private package/import/object models.
5. Apply cross-domain FKs, indexes, and constraints only after the referenced objects exist.
6. Apply Harborlight's immutable Community catalog foundation after cross-domain ownership: SQLite `20260721150000_project_harborlight_phase1`, MySQL `0009_project_harborlight_phase1`.
7. Apply Harborlight durable outbox claims and MySQL relations: SQLite `20260721160000_project_harborlight_relations_outbox`, MySQL `0010_project_harborlight_relations_outbox`.
8. Rebuild only the new SQLite Community tables to enforce foreign keys in `20260721170000_project_harborlight_sqlite_foreign_keys`; `CommunityProfile.accountId` references `UserAccount.id`.
9. Keep legacy tables and strings as compatibility snapshots. No destructive retirement is part of this branch.
