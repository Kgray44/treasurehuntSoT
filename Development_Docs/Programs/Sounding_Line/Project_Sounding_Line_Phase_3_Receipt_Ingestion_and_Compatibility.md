---
title: Project Sounding Line Phase 3 Receipt Ingestion and Compatibility
audience: engineering
status: current
---

# Receipt ingestion and compatibility

`history ingest` accepts only structured, canonicalizable evidence with a run, source, policy, and plan identity. It retains evidence class and cleanup state, rejects secret-like fields and conflicting duplicate run identities, and commits a run plus its suite rows in one SQLite transaction. Additive Phase 2 fields that are absent remain `UNKNOWN`; this is intentionally not interpreted as a clean result, zero duration, or compatibility proof.

Supported evidence classes distinguish machine receipts from committed validation records, synthetic fixtures, human attestations, and external-pending records. The latter four may inform diagnostics but do not establish focused reuse by themselves.
