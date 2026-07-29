---
title: Project Sounding Line Phase 2 Design Record
audience: engineering
status: current
---

# Project Sounding Line Phase 2 Design Record

**Phase:** Open the Channels
**Status:** IMPLEMENTED - FOCUSED VALIDATED - HARBORLIGHT INTEGRATION PENDING
**Base:** `5c0d185695c546337324db20442c6561469da2ed`

## Scope and boundary

Phase 2 implements a local, single-host, nonauthoritative runtime under
`%LOCALAPPDATA%\ForeverTreasureCompanion\SoundingLine\runs`, never inside a
repository or worktree. It consumes only a sealed Phase 1 plan whose digest,
policy identity, source identity format, and dependency graph validate. It
does not execute a product command supplied by metadata: only in-process,
allowlisted pilot handlers may run. `scripts/test-all.ps1` remains the
authoritative release harness.

The runtime is entirely namespaced under `scripts/sounding-line/` and does not
alter `package.json`, Prisma schemas, migrations, Playwright/Vitest
configuration, the validation lock, or a Harborlight worktree.

## Runtime contracts

`runtime.mjs` writes a per-run marker with an unpredictable controller token
and guarded receipt directory. A root must be marked before it can be read,
leased, or cleaned. Repository roots, filesystem roots, and paths nested in a
repository are refused. Cleanup releases only leases bearing the exact run ID
and controller token and retains receipts/evidence rather than deleting an
unknown root.

The broker stores versioned leases under the local runtime base and serializes
updates through a short-lived `wx` lock. A bundle is fully validated before any
lease is written, so a conflict has no partial allocation. Exclusive and
shared-read-only modes are explicit; revision-checked heartbeats reject stale
updates. Expired leases are inspected rather than blindly removed. A missing or
mismatched run marker is classified as ambiguous and quarantined.

SQLite baselines are valid run-owned SQLite databases created through
`node:sqlite`. Clone creation requires a matching immutable-baseline receipt,
refuses every path outside the run database directory, and records clone
identity. Browser contexts and traces receive unique run-owned paths. Owned
HTTP services bind loopback port zero, persist their listener token, and are
stopped only through the retained server handle plus matching run token.

## Scheduling and compatibility

Execution graphs require exactly one node per selected suite, known
dependencies, no cycle, and lexical tie-breaking. Independent ready nodes run
in one concurrent batch; dependent nodes wait for successful producers; no
unregistered executor is permitted. Cancellation is checked before every new
batch.

The compatibility response explicitly reports `EMERGENCY_SERIAL` and keeps
the legacy full harness authoritative. No global-lock narrowing or broad
parallel certification is claimed before Harborlight Phase 4 is accepted and
its resource metadata is reconciled.
