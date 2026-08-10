---
title: Project Shipwright Phase 1 Mainline Safety Manifest
audience: engineering
status: ready-for-owner-walkthrough
canonical_for: project-shipwright-phase-1-mainline-safety
last_reviewed: 2026-08-10
---

# Project Shipwright Phase 1 Mainline Safety Manifest

## Source identity

| Field | Value |
| --- | --- |
| Candidate branch | `codex/project-shipwright-phase1-clear-the-workbench` |
| Candidate commits | `1428c5fba9b54ee7484719f75c5a30d521e12694` then `d0e900e0ac935388a5f1de24307a5a93d0e343eb` |
| Base | `origin/main` at `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3` |
| Governing baseline | `f1c2f22dd935322c1a71eb80c51592f243dc196d` is an ancestor of the base |
| Migration impact | None |
| Database change | None |
| Runtime/API contract change | None |

## Safety assertions

- Existing Studio routes remain available, including dedicated settings, assets, locations, artifacts, and versions surfaces.
- Existing Chronicle draft serialization and all server calls remain the source of truth; Phase 1 only adds local presentation state.
- Existing autosave, conflict preservation, undo/redo, validation response rendering, preview, publication confirmation, and post-publication Lanternwake presentation remain wired through their current handlers.
- Validation severity is presented directly from existing Drydock errors and warnings; Studio adds no rule, severity, waiver, or publish-bypass behavior.
- Passage motion uses only existing journal presentation fields and a finite client vocabulary. Reduced-motion policy remains authoritative.
- New command entries expose only existing canonical actions and existing registry-backed Story Block insertion. They do not create client-defined block semantics or bypass authorization.
- New selection, command-dialog, and canvas view state are client-local and are not added to Prisma or persisted Chronicle data.
- Removing the new presentation modules would leave the underlying current Studio/server behavior intact; no contract migration is required.

## Integration gates

| Gate | State |
| --- | --- |
| Task worktree clean at creation | Passed; isolated local worktree created from the stated base. |
| Focused component evidence | Passed; 27 targeted Studio/shell/journal/motion tests, recorded separately. |
| Full registered Sounding Line evidence | Pending; must remain authoritative. |
| Owner walkthrough | Pending. |
| Commit / push / protected integration | Pending; no claim made by this manifest. |

## Rollback

This change is source-only and has no database, deployment, or provider-state mutation. Rollback is a normal future source revert of the Shipwright commits after integration approval; it requires no data restoration or migration rollback.
