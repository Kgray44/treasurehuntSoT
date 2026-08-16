---
title: Project Deepwater Phase 5 Design Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-5-design-record
last_reviewed: 2026-08-16
---

# Project Deepwater Phase 5 - Keep the Soundings

## Authority and boundary

The owner explicitly authorized Phase 5 on 2026-08-13. Phase 4 remains immutable historical evidence: qualified candidate `10f505d2188f0c51e356ad935503e5236df62256`, protected implementation merge `9e9d629085cb1551b1a3959c31b0b460c37724a9`, and record-only closure merge `582f32a35d918ae892bd2feae766c00043038f39`. The preserved pre-cutover Phase 5 checkpoint is `95497c3d32e76d81723500235821829bd3af58a2`, originally based on accepted `origin/main` `60b89841986e66fbc2c0828489d38002a1617506`.

On 2026-08-14, the original owned branch was reconciled onto accepted `origin/main` `268932d630ee0ea1721d0072da4041f7209b7464`, with no replacement worktree or branch. The preserved checkpoint is semantic history, not a v1.4 authority receipt. Its focused evidence is retained and explicitly rebound through the active v1.4 policy identity `ffe5734091a96b34ca6ecbc077cc46ff99f74ace22ec50a671ed453abd0c509e`.

On 2026-08-16, the same branch merged accepted `origin/main` `3df555a05efee98270dd69bcae32a7e34c814c12` without rewriting published task history. The v1.4 fleet pause is cleared. The reconciliation adds the current `verification-maintenance-policy.json` to the policy identity and settles generated Phase 5 artifacts against the newly written baseline so audit output is immediately self-validating.

Phase 5 owns governance metadata, deterministic audit tooling, policy, validation, and closure records. It does not own product business logic, Prisma schema, live business state, Feature Catalog business facts, or release authority. Sounding Line remains the sole decision emitter.

## Stable baseline and delta model

`Project_Deepwater_Phase_5_Drift_Baseline.json` is the current accepted-main capability snapshot. Stable capability ID is the primary identity; path movement alone is never a new capability. Each row includes the canonical owner, Catalog relationship, audience and privacy disposition, expected and observed rung, routes, screens, journey family, operation/projection references, state/accessibility evidence, finding lifecycle, and evidence source identity.

`Project_Deepwater_Phase_5_Delta_Report.json` compares semantic snapshots in stable capability-ID order. It detects capability, ownership, audience, privacy, rung, classification, Catalog, route, screen, journey, API/action, projection, state, accessibility, evidence, finding, and debt changes. Every delta states source identities, reason, owner, severity when applicable, review requirement, and Sounding Line invalidation effect. Re-running unchanged input must produce byte-identical JSON.

Backend-source additions or removals fail closed as `UNMAPPED_BACKEND_SURFACE` unless `backendSurfaceDispositions` records a current-source path, existing capability, Feature Catalog relationship, canonical owner, and rationale. The v1.4 rebaseline records `src/app/api/internal/bridgewatch/authorize/route.ts` as the private implementation surface of existing `DW-CAP-BRIDGEWATCH-GOVERNED-SIGNAL-PROJECTION` / `FT-035`; this is an evidence adoption, not a new public capability or a Deepwater-owned product change.

## Continuous governance rules

- Every Catalog entry maps to one current Deepwater capability; Deepwater does not generate or hand-edit Catalog facts.
- Human-facing and restricted capabilities must retain valid route, screen, journey, state, and accessibility relationships at their governed terminal rung.
- A closed finding retains closure evidence. A semantic regression becomes an explicit reopening delta; historical closure evidence is retained.
- Internal and security-restricted capabilities retain intentional audience/disposition boundaries. They are not forced into public UI.
- Evidence source identity is retained. Source SHA movement alone is not a regression; affected evidence must be invalidated only through semantic-impact rules.
- New project work records a machine-readable capability-realization impact declaration. `NO_REALIZATION_IMPACT` requires a rationale.
- Completion and current governance language may not claim authority that belongs to Sounding Line or owner acceptance that has not occurred.

## Integration and acceptance

Deepwater remains an impact-selected Sounding Line evidence family. Phase 5 qualification includes its focused tests, structural validation, Feature Catalog validation, documentation validation, affected Homeport inventory checks, and Sounding Line policy checks. Local qualification is `READY_FOR_V14_MAINLINE_ACCEPTANCE`; the cleared pause permits one explicit v1.4 frozen-candidate Mainline Decision followed by protected binding. A separate record-only closure, if eligible under current policy, is limited to source-bound records and indexes.
