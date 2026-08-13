---
title: Project Shipwright Phase 2 Implementation Record
audience: engineering
status: product-mainline-accepted-record-closure-pending
canonical_for: project-shipwright-phase-2-implementation
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Fit the Tools - Implementation Record

## Implemented so far

Phase 2 replaces the selected-Passage generic field surface with a contract-aware Inspector while retaining the existing draft mutation, autosave, conflict, history, preview, validation-panel, and publishing pathways in `TaleEditor`.

| Area            | Delivered implementation                                                                                                                                                                                 | Authority boundary                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspector       | Semantic Content, Behavior, Completion, Presentation, Accessibility, and Advanced accordions with issue counts and focused-section reveal.                                                               | Field labels, grouping, and disclosure are Shipwright UI metadata only.                                                                                                                                  |
| Controls        | Typed text, number, boolean, enum, asset, artifact, location, list, effective-value, duration, and hybrid image-alignment controls.                                                                      | Values, defaults, media requirements, and completion rules come from Drydock contracts.                                                                                                                  |
| Modes           | Guided, Detailed, and Engineering disclosure modes persisted in local UI preference storage.                                                                                                             | Mode changes do not mutate Chronicle data or create a Prisma preference record.                                                                                                                          |
| Logic           | Searchable/filterable variable selector; live-contract-permitted operation selector and typed operand editor; canonical-AST expression editor for comparisons, logical groups, NOT, contains, and count. | Drydock’s variable registry, operation projection, and type checker remain the authority.                                                                                                                |
| Variable rename | Creator confirmation names the affected governed references, Passage count, and expression count; the rename retains stable identity and is undoable/autosaved.                                          | The browser-safe Drydock `renameVariableInDraft` helper propagates only governed configuration references; no arbitrary JSON or prose search/replace occurs.                                             |
| Targets         | Readable chapter-and-Passage targets with duplicate-choice prevention. Target changes project from canonical `BlockConnection` edges through Drydock’s compatibility projection.                         | `BlockConnection` remains graph authority; legacy fields are regenerated, not independently interpreted.                                                                                                 |
| Issues          | Field-local Drydock issue copy, semantic section indicators, and exact field focus from the existing validation panel.                                                                                   | Drydock code, severity, and remediation are rendered without Studio reclassification.                                                                                                                    |
| Compatibility   | Advanced compatibility state offers a creator-scoped, revision-guarded structural migration preview and a confirmation-only apply path.                                                                  | The server calls the Drydock parser to report versions, warnings, affected paths, data-loss, and canonical-output metadata; Studio applies only that canonical output through ordinary history/autosave. |

## Source modules

- `src/components/studio/inspector/ContractAwareInspector.tsx` owns Inspector rendering and purpose-built authoring projections.
- `src/studio/authoring/adapters.ts`, `field-model.ts`, `effective-values.ts`, `drydock-adapter.ts`, `expression-model.ts`, `targets.ts`, and `variables.ts` are browser-safe UI projections. They isolate labels, controls, disclosure, structural expression guidance, graph presentation, and governed variable rename adaptation from contract and graph authority.
- `src/drydock/variable-rename.ts` is the browser-safe canonical rename helper; `src/drydock/variables.ts` preserves the authoritative compatibility export for server callers.
- `src/drydock/migration-preview.ts` and the creator-owned migration route derive structural previews from `parseDrydockBlock`; the browser receives no alternate migration implementation or broad diagnostic payload.
- `src/drydock/variable-explorer.ts` now includes the canonical declaration description in its owner-only Explorer projection.
- The owner-authorized Variable Explorer GET remains private/no-store and now correctly uses the canonical read authorization path without requiring a mutation CSRF header. Mutating Studio routes continue to require the existing CSRF check.
- `src/components/studio/TaleEditor.tsx` remains the coordinator and provides the existing canonical mutation/history/autosave path to the Inspector.
- `scripts/shipwright/prepare-phase2-fixture.mjs`, `seed-phase2-fixture.mjs`, and `run-phase2-journeys.mjs` create a fresh task-owned SQLite fixture, synthetic Creator credential handoff, dynamic local port, and isolated browser evidence. `phase2-walkthrough-runtime.mjs` prepares, starts, verifies, and safely stops a separate task-owned production owner-review environment. The scripts refuse canonical database paths and unrelated port owners.
- `src/styles/studio.css` adds accessible Inspector, issue, responsive drawer, and focus styling.

## Explicit non-changes

- No Prisma schema, migration, generated-client, provider, publication, One Voyage runtime, or Story Block family change.
- No new Drydock schema, default, validator, expression language, variable-operation vocabulary, or authorization mechanism.
- No raw storage keys, credentials, private Player data, or secret diagnostics are added to the client surface.
- No Shipwright Phase 3 templates, fragments, new Story Block activation, or composition work is included.

## Completion state

Implementation, owner acceptance, exact-source Sounding Line authority, and
protected-main product integration are complete. Candidate
`00e58fc427d97d5775e1b911ea8f62ba428b0c51` received `RELEASE_GO` in run
`31662185476`; its sealed envelope contains 38 mandatory clean receipts.
Protected binding run `31662099042` consumed that envelope and PR #72 merged
the candidate as `25a5ecc3989d137a95291c340f07143860b821cc`.

This closeout changes no product source. It promotes the accepted capability's
records and Feature Catalog entry only. Shipwright Phase 3 remains not started.
