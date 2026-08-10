---
title: Project Drydock Phase 1 Mainline Safety Contract
audience: engineering
status: current
canonical_for: project-drydock-phase-1-mainline-safety
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 Mainline Safety Contract

Project Drydock Phase 1 is an `ADDITIVE_FOUNDATION` with a bounded `COMPATIBLE_MIGRATION` seam for current version-1 generic Passage configuration. It begins at accepted mainline `5b266251bd5a42efe90988e45daf55bca8e566f1`.

| Required field        | Frozen Phase 1 declaration                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post-phase capability | Every current Passage type has a strict versioned authoring contract; typed variables and expressions, deterministic canonicalization, compatibility migrations, stable issues, and incremental contract validation are available. |
| Active behavior       | Existing Creator Studio authoring, validation, preview, autosave, publishing, and One Voyage progression remain active. Schema-level validation routes through the Drydock contract authority.                                     |
| Dormant behavior      | Whole-Chronicle graph/state analysis, issue navigation UX, simulation, scenarios, faults, coverage, waivers, immutable publishing evidence, and the full Drydock workspace remain unavailable.                                     |
| Compatibility         | Current valid version-1 drafts remain readable through deterministic in-memory upcasts. Immutable published snapshots are never rewritten. Existing validator protections remain active.                                           |
| Future work           | Phases 2-4 remain intentionally unfinished and are not required for Phase 1 correctness.                                                                                                                                           |
| Schema impact         | Prisma changes: **NO**. Database models, migrations, and backfills: **NONE**. Story Block contract versions advance in the contract layer only.                                                                                    |
| Rollback / disable    | Revert the additive Drydock modules and narrow Chronicle integration. No data restore is required because there is no mass migration or persisted schema change.                                                                   |
| Permanent-stop test   | **YES**. Main remains coherent if no later Drydock phase is implemented.                                                                                                                                                           |

## Authority and ownership

Drydock owns canonical authored Passage contract semantics. Shipwright retains Creator Studio interaction, layout, and authoring ergonomics. One Voyage retains progression, runtime variables, event ordering, completion, and immutable publication-transaction authority. Other domain owners retain assets, providers, locations, artifacts, privacy, and presentation-runtime semantics; Drydock consumes typed references without absorbing their business logic.

## Activation boundaries

- Existing authoring experience: `ACTIVE`.
- Drydock typed foundation: `ACTIVE_INTERNAL_AND_COMPATIBILITY`.
- Runtime authority: `UNCHANGED`.
- Publication authority: `UNCHANGED`.
- Simulation: `NOT_IMPLEMENTED`.
- Phase 2 full static analysis: `NOT_IMPLEMENTED`.
- Full Drydock workspace: `NOT_EXPOSED`.

## Required acceptance evidence

Sounding Line must select and finalize the exact candidate evidence for strict schemas, variables, expressions, compatibility, current validator behavior, Studio compatibility, One Voyage no-regression, privacy/security, formatting, types, architecture, and production build. Local evidence is not mainline acceptance.
