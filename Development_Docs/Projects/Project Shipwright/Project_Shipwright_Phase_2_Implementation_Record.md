---
title: Project Shipwright Phase 2 Implementation Record
audience: engineering
status: active
canonical_for: project-shipwright-phase-2-implementation
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Fit the Tools - Implementation Record

## Implemented so far

Phase 2 replaces the selected-Passage generic field surface with a contract-aware Inspector while retaining the existing draft mutation, autosave, conflict, history, preview, validation-panel, and publishing pathways in `TaleEditor`.

| Area          | Delivered implementation                                                                                                                                                                   | Authority boundary                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspector     | Semantic Content, Behavior, Completion, Presentation, Accessibility, and Advanced accordions with issue counts and focused-section reveal.                                                 | Field labels, grouping, and disclosure are Shipwright UI metadata only.                                                                                              |
| Controls      | Typed text, number, boolean, enum, asset, artifact, location, list, effective-value, duration, and hybrid image-alignment controls.                                                        | Values, defaults, media requirements, and completion rules come from Drydock contracts.                                                                              |
| Modes         | Guided, Detailed, and Engineering disclosure modes persisted in local UI preference storage.                                                                                               | Mode changes do not mutate Chronicle data or create a Prisma preference record.                                                                                      |
| Logic         | Searchable/filterable variable selector; permitted operation selector and typed operand editor; canonical-AST expression editor for comparisons, logical groups, NOT, contains, and count. | Drydock’s variable registry and type checker remain the authority.                                                                                                   |
| Targets       | Readable chapter-and-Passage targets with duplicate-choice prevention. Target changes project from canonical `BlockConnection` edges through Drydock’s compatibility projection.           | `BlockConnection` remains graph authority; legacy fields are regenerated, not independently interpreted.                                                             |
| Issues        | Field-local Drydock issue copy, semantic section indicators, and exact field focus from the existing validation panel.                                                                     | Drydock code, severity, and remediation are rendered without Studio reclassification.                                                                                |
| Compatibility | Advanced compatibility state identifies an older block version and directs the Creator to obtain the server-side Drydock migration result.                                                 | The browser never guesses, parses, or applies a migration; a current server-confirmed migration endpoint is required before an apply workflow can be safely enabled. |

## Source modules

- `src/components/studio/inspector/ContractAwareInspector.tsx` owns Inspector rendering and purpose-built authoring projections.
- `src/studio/authoring/adapters.ts`, `field-model.ts`, `effective-values.ts`, `drydock-adapter.ts`, `expression-model.ts`, and `targets.ts` are browser-safe UI projections. They isolate labels, controls, disclosure, structural expression guidance, and graph presentation from contract and graph authority.
- `src/drydock/variable-explorer.ts` now includes the canonical declaration description in its owner-only Explorer projection.
- The owner-authorized Variable Explorer GET remains private/no-store and now correctly uses the canonical read authorization path without requiring a mutation CSRF header. Mutating Studio routes continue to require the existing CSRF check.
- `src/components/studio/TaleEditor.tsx` remains the coordinator and provides the existing canonical mutation/history/autosave path to the Inspector.
- `src/styles/studio.css` adds accessible Inspector, issue, responsive drawer, and focus styling.

## Explicit non-changes

- No Prisma schema, migration, generated-client, provider, publication, One Voyage runtime, or Story Block family change.
- No new Drydock schema, default, validator, expression language, variable-operation vocabulary, or authorization mechanism.
- No raw storage keys, credentials, private Player data, or secret diagnostics are added to the client surface.
- No Shipwright Phase 3 templates, fragments, new Story Block activation, or composition work is included.

## Completion state

Implementation is ready for the wider qualification and owner-review gates, not yet a frozen candidate. The companion validation, safety, coverage, and owner-walkthrough records deliberately distinguish focused evidence from candidate, owner, Sounding Line, and protected-main evidence. The migration apply experience remains intentionally unavailable until a server-confirmed canonical migration path exists; it is not simulated in Shipwright.
