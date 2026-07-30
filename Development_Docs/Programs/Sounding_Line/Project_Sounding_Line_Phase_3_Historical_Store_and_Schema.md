---
title: Project Sounding Line Phase 3 Historical Store and Schema
audience: engineering
status: current
---

# Historical store

The store uses Node SQLite with foreign keys, WAL reader safety, an immediate writer transaction, and an explicit schema-migration table. Version 1 holds `historical_runs`, `suite_executions`, `decisions`, and `audit_events`. Canonical payload digests make ingestion idempotent and reject a duplicate run ID with differing content. The command `sounding-line history status` runs SQLite integrity verification; populated databases are intentionally outside Git.

Historical rows store only bounded, redacted validation identities and outcomes. No credentials, tokens, private content, raw environments, or application business data are accepted. Existing Phase 2 receipts can identify unknown additive timing and environment fields without treating them as zero or as clean evidence.
