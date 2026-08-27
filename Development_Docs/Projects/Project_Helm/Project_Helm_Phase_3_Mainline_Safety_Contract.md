---
title: Project Helm Phase 3 Mainline Safety Contract
audience: product-engineering
status: current
canonical_for: project-helm-phase-3-mainline-safety-contract
last_reviewed: 2026-08-27
---

# Project Helm Phase 3 mainline safety contract

After Phase 3, an authorized Captain can operate a live Voyage from one
privacy-safe console. Commands are contextual to current canonical state,
prepared against a visible revision, confirmed when meaningful, idempotent on
retry, and rejected safely when the Voyage has changed. The console presents a
safe progress map, current attention, Crew state, and canonical outcome
history; it does not replace One Voyage authority.

The change preserves accepted P1 Captain-only and Captain + Player semantics,
ordinary Player membership, A1 lifecycle actions, A2 authority succession and
continuity, A3 Ready Room behavior, current Player projections, published
edition identity, artifact/history boundaries, and existing raw compatibility
endpoints. A Captain still has no access to Creator notes, drafts, hidden
answers, Player-private memories/reflections, raw verification evidence, or
device/account/session detail through this console.

The only canonical writes remain the existing Captain actions and their
existing event/verification mutations. Phase 3 adds neither a schema migration
nor a parallel command/event store. Safe projection reads do not advance a
Voyage. Stale requests fail before a new mutation; duplicate retries return the
already-recorded canonical result.

Intentionally unfinished: P4 provider fallback, preflight, recovery,
reconciliation operations, and any external device/provider control remain
outside this phase. If work stops here, Captains have a coherent, safe live
operations console while all existing canonical safety boundaries remain valid.
