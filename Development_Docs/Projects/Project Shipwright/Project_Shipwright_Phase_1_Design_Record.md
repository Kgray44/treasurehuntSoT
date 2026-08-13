---
title: Project Shipwright Phase 1 Design Record
audience: engineering
status: active
canonical_for: project-shipwright-phase-1-design
last_reviewed: 2026-08-10
---

# Project Shipwright Phase 1: Clear the Workbench - Design Record

## Authority and baseline

| Field                        | Value                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Phase                        | Phase 1 - Clear the Workbench                                                                     |
| Branch                       | `codex/project-shipwright-phase1-clear-the-workbench`                                             |
| Worktree                     | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-shipwright-phase1-v2`      |
| Base / fetched `origin/main` | `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`                                                        |
| Governing baseline           | `f1c2f22dd935322c1a71eb80c51592f243dc196d` (ancestor of current base)                             |
| Primary project document     | `Project_Shipwright_Creator_Studio_Authoring_Experience_Governing_Document.pdf`, v1.0, 2026-08-08 |
| Global authority             | Voyagewright Global Product Governance Standard, current                                          |
| Integration authority        | Voyagewright Continuous Development and Mainline Integration Standard v1.0                        |
| Verification authority       | Current Project Sounding Line policy and registered suites                                        |
| Prisma impact                | **NONE planned**                                                                                  |

## Frozen ownership boundary

Shipwright owns the Creator Studio interaction and presentation layer: workspace information architecture, component decomposition, command presentation, selection/focus behavior, canvas presentation, pointer and keyboard UX, responsive panels, and compatibility adapters.

Shipwright does **not** define Story Block schemas, variables, expressions, validation rules, graph semantics, simulator state, persisted Chronicle truth, immutable publication truth, runtime progression, protected-media authorization, Community lineage, semantic edition differences, or substantive animation truth. Drydock, One Voyage, Sealed Hold, Harborlight, Tideglass, and Lanternwake remain the corresponding canonical owners.

Phase 1 consumes current canonical services and contracts. It does not introduce a second schema, variable, validation, graph, or persistence representation. Presentation preferences remain client-local unless a later, explicitly justified record demonstrates a non-semantic persistence need.

## Current Studio concern map

| Concern                                       | Current file(s)                                                     | State / mutation owner                | Server dependency                 | UI consumers                       | Tests                             | Phase 1 disposition |
| --------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | --------------------------------- | ---------------------------------- | --------------------------------- | ------------------- |
| Editor orchestration                          | `src/components/studio/TaleEditor.tsx` (119,277 bytes; 2,889 lines) | React shell                           | Studio tale routes                | tale detail routes                 | `TaleEditor.test.tsx`, Studio E2E | EXTRACT             |
| Canonical draft loading and persistence       | `TaleEditor.tsx`; `src/chronicle/studio-service.ts`                 | Local draft + canonical service       | `/api/studio/tales/:id`, `/draft` | canvas, inspector, header          | component and E2E                 | EXTRACT / PRESERVE  |
| Autosave, conflict, undo/redo                 | `TaleEditor.tsx`                                                    | Local history / server revision token | draft PATCH                       | status, canvas, inspector          | `TaleEditor.test.tsx`             | EXTRACT / PRESERVE  |
| Story Block insertion and structural movement | `TaleEditor.tsx`; dnd-kit                                           | Canonical draft operations            | autosave only                     | Library and structural canvas      | component and E2E                 | REORGANIZE          |
| Selection, focus and inspector handoff        | `TaleEditor.tsx`                                                    | client presentation state             | none                              | canvas and inspector               | component tests                   | EXTRACT             |
| Assets, locations and artifacts               | `TaleEditor.tsx`; Studio asset routes                               | canonical library services            | Studio asset/library APIs         | Library and dedicated sections     | component and E2E                 | WRAP / PRESERVE     |
| Preview / reduced motion                      | `TaleEditor.tsx`; published block renderer                          | client presentation                   | Studio preview API                | header and preview dialog          | component and E2E                 | WRAP / PRESERVE     |
| Validation and publishing                     | `TaleEditor.tsx`; Drydock / Chronicle services                      | canonical authorities                 | validate and publish APIs         | header, issue list, publish status | component and E2E                 | WRAP / PRESERVE     |
| Publishing presentation                       | `TaleEditor.tsx`; Lanternwake SceneHost                             | Lanternwake presentation only         | canonical publish API             | status header                      | component tests                   | PRESERVE            |
| Studio visuals / responsive layout            | `src/styles/studio.css`                                             | presentation only                     | none                              | all Studio surfaces                | E2E screenshots                   | REORGANIZE          |

## Phase 1 module boundary

`TaleEditor` becomes the compatibility entry point and Studio shell coordinator, limited to tale identity, loaded canonical data, command wiring, cross-region navigation, and existing route-section compatibility. Cohesive modules will own the status header, Library, Chronicle Canvas, Inspector, contextual selection tools, command palette, draft/history services, selection/focus service, and presentation preferences.

The default workspace is Library / Canvas / Inspector with a compact status header and a transient context shelf. Existing dedicated Assets, Waypoints, Artifacts, Settings, and Versions routes remain supported through the current section adapter rather than being removed or given new semantics.

## Interaction, accessibility, and responsive contract

- Commands have stable IDs, labels, availability predicates, keyboard shortcuts where appropriate, and no client-only authorization bypass.
- Selection is presentation-only and supports one selected block initially; Phase 1 adds a non-semantic multi-selection foundation without changing Story Block relationships.
- Opening the Inspector records and restores the originating focus target when it closes. Focus moves to the Inspector title only on an intentional opening.
- dnd-kit remains the pointer/keyboard drag owner. Motion must not own the same node transform. Move-to-position/chapter commands provide non-drag parity.
- The canvas gains pan/zoom, fit, and visible layout guidance as presentation controls only. Structural order remains the canonical Chronicle order.
- Desktop uses three regions; narrower layouts collapse Library and Inspector into accessible drawers; phone retains a usable outline/structural route rather than a tiny graph.
- Save, conflict, validation-stale, preview-unavailable, provider-unavailable, publish-failed, and published states remain truthful. No successful presentation precedes authoritative publication.

## Preservation and testing plan

The phase preserves current canonical autosave versioning, local unsaved-change preservation, undo/redo, current asset/location/artifact library behavior, preview, version comparison, Drydock validation presentation, One Voyage publication result, Creator authorization, CSRF, and Lanternwake's post-success presentation boundary.

Affected evidence includes the registered `component.studio` and `browser.studio` families, current `TaleEditor` component coverage, the Studio browser journey, keyboard/focus behavior, responsive desktop/tablet/phone evidence, reduced motion, accessibility, and a task-owned visual walkthrough. Raw runners are diagnostic only; Sounding Line's current finalizer remains authoritative for release claims.

## Mainline Safety Contract and Phase 2 boundary

If Shipwright stops after Phase 1, Creator Studio still authors the same canonical Chronicle data and supports the same current block behavior, autosave/conflict recovery, undo/redo, libraries, preview, validation, versioning, and publishing. The only permanent difference is a cleaner, more modular, more accessible interaction layer. No Prisma migration or canonical database change is planned.

Phase 2 is expressly excluded: contract-aware block editors, variable/expression authoring, new validation meaning, and any new Story Block semantics require a fresh branch from accepted main and consume Drydock's authority rather than recreating it here.
