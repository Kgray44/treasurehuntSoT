---
title: Project Shipwright Phase 1 Mainline Safety Manifest
audience: engineering
status: accepted-mainline
canonical_for: project-shipwright-phase-1-mainline-safety
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 1 Mainline Safety Manifest

## Source identity

| Field                       | Value                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Acceptance-repair branch    | `codex/project-shipwright-phase1-acceptance-repair`                                        |
| Validated source            | `d7f3d0a2c9889134919402b8338f9df5095c657f`                                                |
| Validated base              | `origin/main` at `236c27241bb8d1630274f5d5412ec9addbdb8893`                                |
| Governing baseline          | `f1c2f22dd935322c1a71eb80c51592f243dc196d` is an ancestor of the base                      |
| Migration impact            | None                                                                                       |
| Database change             | None                                                                                       |
| Runtime/API contract change | None                                                                                       |

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

| Gate                                   | State                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Task worktree clean at creation        | Passed; isolated local worktree created from the stated base.               |
| Focused component evidence             | Passed; 27 targeted Studio/shell/journal/motion tests, recorded separately. |
| Full registered Sounding Line evidence | Passed: hosted run `31568707098` returned `RELEASE_GO` for the validated source, plan `84d5ea51cd6301b95409b11aa4884914ebc0ebc068a1f0fce830c43dbf38aaef`, evidence `b7dbe23b6a9d55af528323a03ab3f8d2dd4ea7f213d8855b616f3bc9558df07b`. |
| Owner walkthrough                      | Satisfied by prior owner review plus explicit waiver of a post-correction repeat walkthrough. |
| Commit / push / protected integration  | Confirmed through protected PR #48 integration into `origin/main`.          |

## Rollback

This change is source-only and has no database, deployment, or provider-state mutation. Rollback is a normal future source revert of the Shipwright commits after integration approval; it requires no data restoration or migration rollback.

## Acceptance result

`MAINLINE_SAFETY_CONTRACT = PASS`.

The acceptance repair found and removed a rebased duplicate `close` declaration in `StudioCommandPalette` before the authoritative run. It also repaired the task-owned validation dependency layout that had previously failed closed before Vitest could execute. The accepted source preserves all listed safety assertions; neither repair changes Chronicle semantics, Drydock authority, One Voyage authority, data, providers, or deployment state.
