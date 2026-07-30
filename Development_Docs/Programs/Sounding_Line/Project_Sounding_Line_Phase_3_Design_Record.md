---
title: Project Sounding Line Phase 3 Design Record
audience: engineering
status: current
---

# Project Sounding Line Phase 3: Read the Current

## Implementation scope and boundary

This branch adds local, non-release-authoritative verification intelligence on top of the accepted Phase 2 runtime. It does not alter product behavior, Prisma schemas, the global full-release lock, `npm run validate`, external-provider authority, or Phase 4. The historical store is a local SQLite database below the per-user Sounding Line state root, never a worktree or application database.

`scripts/sounding-line/phase3.mjs` owns structured runs, suite executions, decisions, and audit events; all payloads have canonical SHA-256 identities. Receipt ingestion is transactional and idempotent, rejects conflicting replay and secret-like fields, and represents omitted additive fields as `UNKNOWN`. The policy has advanced from 1.1.0 to 1.2.0 because it now declares Phase 3 semantics.

## Safety model

Impact remains conservative: unknown ownership expands selection. Evidence is reusable only when freshness is exact and cleanup is clean; release-gate reuse is prohibited. Resume requires matching source, policy, and plan identities. Equivalent active journal entries suppress duplicate work. Root/cascade normalization, stable redacted signatures, deterministic sharding, and throttling are computation-only controls that never lower proof requirements.

## Interfaces and rollback

The repository CLI exposes `history` and `phase3` commands alongside—not instead of—the Phase 2 CLI. Deleting no history is required to roll back: callers may simply continue using the Phase 2 focused runtime and `npm run validate`. Local history and journal data remain audit material outside Git.
