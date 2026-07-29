# Community Harbor Backup and Recovery

The Harborlight backup unit includes Community records, moderation history, scan receipts, package/derivative inventory references, search reconstruction facts, license/attribution/lineage snapshots, consent facts, audit correlation, schema migration, and source identity. It never contains credentials or private source content.

`community:backup` writes a checksum-bound manifest only to an absolute isolated root outside the repository. `community:restore-verify` verifies a named manifest without writing to a database. Production restore requires a separately authorized isolated target and remains an external acceptance gate.
