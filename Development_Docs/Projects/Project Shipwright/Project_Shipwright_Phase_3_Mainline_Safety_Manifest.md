---
title: Project Shipwright Phase 3 Mainline Safety Manifest
audience: engineering
status: active
canonical_for: project-shipwright-phase-3-mainline-safety
last_reviewed: 2026-08-13
---

# Project Shipwright Phase 3: Shape the Chronicle - Mainline Safety Manifest

## Candidate state

`MAINLINE_SAFETY_CONTRACT = PENDING_QUALIFICATION`.

The branch is an active implementation candidate. It has not received a frozen-candidate Mainline Decision, `RELEASE_GO`, protected merge binding, or protected-main integration. This manifest must not be read as an approval to dispatch an authority run before the candidate is frozen and its required evidence is complete.

## Safety assertions to qualify

- The 23 current canonical Story Block contracts remain the only active semantics; reusable content composes them without adding a parallel type, parser, runtime, or migration authority.
- Owner scoping applies to reusable list/read/archive/create/plan/use paths; cross-account and cross-Chronicle misuse fail closed.
- Captures exclude protected/private material and all envelopes are checksum-verified, size-bounded, immutable snapshots.
- Parameter definitions use only safe enumerated types and existing canonical fields. Values and their resolved dependencies are checked before a plan can be applied.
- A proposed insertion cannot introduce a new Drydock error. Provider dependencies remain unavailable unless an accepted owner adapter can resolve them.
- One insertion is one ordinary Studio history/autosave mutation with source-version provenance; undo/redo does not create a mutable transclusion.
- Harborlight is read-only metadata unless it supplies a canonical authoring envelope. Landfall and Watchglass remain inactive.
- The 100-plus Passage, multi-Chapter composition fixture must preserve stable remapping, collision avoidance, undo/redo, autosave, and Drydock revalidation.

## Permanent-stop condition

If Phase 3 stops before acceptance, existing Phase 1/2 authoring, the 23 current blocks, current Chronicle publication/runtime, and provider ownership boundaries remain usable. The additive reusable-library schema must remain unapplied outside an isolated rehearsal until its migrations and full candidate are qualified. No partial Phase 3 record grants release authority.

## Required closeout evidence

1. Re-run exact-source format, lint, typecheck, build, documentation/index validation, focused and governed regression suites, security/privacy checks, and the isolated migration rehearsal.
2. Capture task-owned browser and accessibility/responsive evidence for private Library, parameter prompt, preview/cancel, insert/undo/autosave, compatibility error, and owner/IDOR denial journeys.
3. Freeze the candidate, reconcile current `origin/main` as required by the governed workflow, and produce one authoritative Mainline Decision only after all local evidence is clean.
4. Accept only a SHA-bound `RELEASE_GO` followed by successful protected merge binding, merge identity/ancestry verification, and fresh remote parity. Otherwise retain `PENDING_QUALIFICATION`.
