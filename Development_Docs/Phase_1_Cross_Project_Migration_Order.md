# Phase 1 Cross-Project Migration Order

The migration ledger records directory names and file checksums; SQLite applies lexical timestamp directories and MySQL uses the checked-in numeric directories/scripts. Candidate migration use was limited to disposable validation databases according to their records. Therefore the duplicate candidate MySQL `0005` names are not preserved: One Voyage remains `0005`, Wayfarer is `0006`, and Sealed Hold will be assigned `0007` before its integration.

Do not apply this sequence to a production database. Each environment requires a backup, a fresh-schema rehearsal, checksum capture, and a bounded reconciliation report first.

1. Apply One Voyage, including the `TallTale` to `Chronicle` physical-table rename.
2. Apply Wayfarer account tables and nullable Player linkage.
3. Run deterministic identity/actor backfill; record collisions and leave ambiguous matches unresolved.
4. Apply Sealed Hold private package/import/object models.
5. Apply cross-domain FKs, indexes, and constraints only after the referenced objects exist.
6. Keep legacy tables and strings as compatibility snapshots. No destructive retirement is part of this branch.
