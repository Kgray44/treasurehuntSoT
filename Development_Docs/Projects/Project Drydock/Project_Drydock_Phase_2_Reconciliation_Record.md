---
title: Project Drydock Phase 2 Reconciliation Record
audience: engineering
status: active
canonical_for: project-drydock-phase-2-reconciliation
last_reviewed: 2026-08-10
---

# Project Drydock Phase 2 reconciliation record

## Reconciled inputs

- Original Phase 2 base: `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`.
- Drydock pre-reconciliation candidate: `04c069bc8557da7e67844c27fc31a90ae6a106c0`.
- Current accepted main at reconciliation: `384ad39fbc40e8cbe16dd2aa2c83abd3e00a56c6` (Shipwright Phase 1).
- Reconciled implementation commit: `14cc8301d16c8ba02622c7ea15eb5049cd65b88e`.

## Semantic resolution

Shipwright introduced the Studio workbench, multi-selection, shared Studio types, and a movable validation-results panel. Drydock independently added static-analysis navigation, rule details, revision-bound safe repair, graph annotations, and variable exploration. The integration preserves both: Drydock's legacy target mirror remains explicitly modeled in the shared `Block` type, its controls reside in Shipwright's movable validation panel, and graph annotations coexist with Shipwright selection and keyboard handling.

Strict TypeScript and the combined `TaleEditor` test suite pass on the reconciled implementation commit. The final candidate must include this record and obtain a fresh Sounding Line mainline decision; the earlier `04c069bc` local-change receipt is evidence only and is not final acceptance.

## Boundary

No Phase 3 simulator, virtual time, scenario runtime, or live Tale Session mutation was introduced by this reconciliation.
