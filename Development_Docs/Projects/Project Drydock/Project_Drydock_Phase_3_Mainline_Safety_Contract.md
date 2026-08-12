---
title: Project Drydock Phase 3 Mainline Safety Contract
audience: engineering
status: current
canonical_for: project-drydock-phase-3-mainline-safety
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 Mainline Safety Contract

## Additive and canonical boundary

Phase 3 is an additive deterministic-simulation slice. It consumes accepted Drydock contracts and the One Voyage-owned runtime transition semantics. Production progression and simulation must share the same pure transition adapter; Drydock cannot maintain a parallel progression engine.

The only persistent additions are source-bound Scenario/Suite revisions and bounded Simulation Run summaries/checkpoints. They contain no authoritative player state and are linked to their owner Chronicle. Existing `DrydockValidationRun` and `DrydockRuleWaiver` rows, Studio autosave, immutable published snapshots, and all One Voyage live records remain compatible and untouched.

## Fail-closed invariants

- A run starts only against an exact source checksum and supported Scenario schema/adapter version.
- Any source, scenario, adapter, or limits mismatch produces `STALE_SOURCE`, `UNSUPPORTED`, or `INCOMPLETE_PROOF`; it never reuses a green result.
- Simulation state and injected faults are isolated in memory or task-owned disposable persistence. No code path writes `TaleSession`, `TaleSessionEvent`, membership, invitation, Creator draft, published version, real grant, Memory, Community, or protected asset state.
- Clock, randomness, provider outcomes, environment, and fault schedule are explicit. Ambient `Date.now`, timer scheduling, network outcomes, iteration order, and global random state cannot determine a result.
- Every traversal and trace has fixed limits. Exhaustion and cancellation are durable, observable terminal states, not a pass.
- Scenario/trace/run routes are owner- or collaborator-authorized, CSRF-protected when mutating, source-bound, privacy-redacted, and no-store where authorized content is displayed.
- Generated Scenario suggestions remain unsaved drafts; they cannot fabricate answers or alter author content.
- A runtime mismatch is a blocking differential result. It cannot be waived as a Drydock warning.

## Rollback

Application rollback removes Phase 3 routes, UI, executor use, and new tables from active paths while leaving additive Scenario and Run rows inert. No source snapshot, live Session, event, membership, artifact, or published Chronicle requires restoration. Physical deletion or retention policy for synthetic Scenario/Run records is a future governed operation; rollback must not run a destructive migration.

## Permanent-stop status

**YES after Phase 3 acceptance.** Main remains coherent if Phase 4 never starts: deterministic simulation and Studio proof facilities remain available, while final immutable publishing-evidence and launch integration stay explicitly unavailable.
