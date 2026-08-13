---
title: Project Shipwright Phase 3 Implementation Record
audience: engineering
status: active
canonical_for: project-shipwright-phase-3-implementation
last_reviewed: 2026-08-13
---

# Project Shipwright Phase 3: Shape the Chronicle - Implementation Record

## Current implementation

Phase 3 adds a private Creator Library for reusable authoring composition without creating a new Story Block semantic type. The additive persistence boundary consists of `ReusableAuthoringItem`, immutable `ReusableAuthoringItemVersion`, and draft-local `ReusableAuthoringUsage`, with matched SQLite/MySQL migrations reserved in [the migration reservation](Project_Shipwright_Phase_3_Migration_Reservation.json).

| Area               | Implemented behavior                                                                                                                                                                       | Boundary preserved                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Capture            | A saved canonical Passage becomes a preset; a persisted multi-Passage selection becomes a fragment; a persisted Chapter becomes a template.                                                | The server reloads authorized persisted source identities and rejects client-authored reusable bodies.                      |
| Safety             | Capture rejects Creator notes, private/non-player-safe material, sensitive field names, and the Sealed Hold sentinel.                                                                      | No secret, private Player/Captain state, executable payload, or provider credential enters an envelope.                     |
| Version/provenance | Canonical envelopes are checksummed and version-scoped; saved copies record source item/version attribution and lineage.                                                                   | A reusable insertion is a copy, never mutable transclusion.                                                                 |
| Planning           | The server verifies owner scope, checksum, safe typed parameter values, destination dependencies, and newly introduced Drydock errors before returning a plan.                             | Drydock remains the parser/static-analysis authority; One Voyage remains the persistence/publication/runtime authority.     |
| Application        | Existing Studio history and autosave apply the full plan as one normal mutation, allowing one undo/redo step and atomic provenance persistence.                                            | Phase 2 draft, conflict, preview, and publication pathways remain in control.                                               |
| Library            | Creator-visible list/search/filter/ranking, contextual compatibility reasons, explicit insertion confirmation, preview cancellation, and keyboard-reachable parameter prompts are present. | No new ontology, expression language, or unowned provider runtime is created.                                               |
| Harborlight        | Clean active installations are projected read-only with release, license, attribution, compatibility, and update state.                                                                    | Package items do not contain canonical authoring envelopes, so insertion is deliberately unavailable rather than simulated. |

## Explicit non-changes

- No Phase 4 simulation UX or Phase 5 publishing overhaul.
- No new Drydock block contract, static rule, migration language, or runtime semantic.
- No Landfall or Watchglass category is presented as active content.
- No Harborlight package/release/install/lineage authority is modified or duplicated.
- No production or canonical database migration has been applied.

## Current qualification state

This is an active implementation record, not a completion receipt. Focused reusable-content, reusable route, editor, and Drydock incremental tests plus TypeScript have passed from the current working candidate. Remaining work includes complete local qualification, isolated migration rehearsal, browser/accessibility evidence, frozen-candidate hosted authority, protected binding, merge evidence, current-main ancestry, and remote parity. No `RELEASE_GO`, owner acceptance, or Mainline Decision is claimed here.
