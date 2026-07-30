---
title: Project Sounding Line Phase 3 Historical Store and Schema
audience: engineering
status: current
---

# Historical store

The store uses Node SQLite with foreign keys, WAL reader safety, an immediate writer transaction, and an explicit schema-migration table. Ordered SQL migrations under `scripts/sounding-line/history-migrations/` establish version 1 core receipts and version 2 entities. Version 2 retains `historical_runs`, `suite_executions`, `decisions`, and `audit_events`, and adds structured entity tables for historical plans/nodes, attempts, case execution, resources, failures/signatures, evidence/cleanup, environment/performance, policy/source snapshots, reuse/invalidation/rerun decisions, flake/stale/slow records, throttle decisions, and recovery events. Each entity has a stable ID, run join, searchable subject/status/timing fields, canonical payload digest, and redacted JSON payload.

Canonical payload digests make ingestion idempotent and reject a duplicate run ID with differing content. An unreadable or corrupt store opens as `HISTORICAL_STORE_UNAVAILABLE`, never as usable partial evidence. `sounding-line history status` verifies SQLite integrity; `sounding-line history entities <entity> [subject-id]` exposes bounded, redacted review records. Retention deletes child rows and parent receipts transactionally. Populated databases are intentionally outside Git.

Historical rows store only bounded, redacted validation identities and outcomes. No credentials, tokens, private content, raw environments, or application business data are accepted. Existing Phase 2 receipts can identify unknown additive timing and environment fields without treating them as zero or as clean evidence.
