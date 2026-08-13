---
title: Project Shipwright Phase 1 Implementation Record
audience: engineering
status: accepted-mainline
canonical_for: project-shipwright-phase-1-implementation
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 1: Clear the Workbench - Implementation Record

## Scope delivered

Phase 1 reorganizes the Creator Studio authoring interaction without changing Chronicle meaning or server authority. The existing `TaleEditor` route remains the compatibility entry point and retains the current draft load/save, autosave conflict, undo/redo, preview, validation, and immutable publication calls.

| Area                    | Delivered behavior                                                                                                                                                                                         | Canonical boundary preserved                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Status header           | Extracted `StudioStatusHeader` with explicit undo/redo, save state, preview, validation, publish, command, and More actions.                                                                               | Publish state is rendered only from the existing authoritative response.                                                               |
| Command architecture    | Added searchable `StudioCommandPalette` with stable IDs for existing actions and existing registry insertion. `Ctrl/Cmd+K`, Escape, backdrop close, initial focus, and focus restoration are supported.    | Commands call existing handlers and canonical APIs; no client authorization, validation, or block semantics were added.                |
| Selection/focus         | Added a presentation-only selected-ID set, keyboard-reachable block cards, additive Ctrl/Cmd and range Shift selection, inspector focus return, and contextual selection shelf.                            | Selection is not persisted and does not define graph or Story Block relationships.                                                     |
| Canvas view foundation  | Added bounded 80-120% view zoom, vertical pan, fit/reset controls, and whole-Passage pointer drag reordering.                                                                                              | View state is local; Chronicle order remains the existing ordered chapter/block truth.                                                 |
| Non-drag parity         | Retained the existing move buttons and keyboard dnd-kit behavior; the contextual shelf can move a multi-selection to the following existing chapter.                                                       | It only moves existing blocks through the current draft mutation/save path.                                                            |
| Passage animation       | Added ten Shipwright presentation presets for opening, leaving, and active Passage states, persisted through existing journal presentation fields and honored by the Studio preview and published journal. | No Story Block schema or new persisted field was introduced; invalid/unknown values resolve to the existing safe presentation default. |
| Validation presentation | Added explicit saved / verifying / validation status, human-readable blocking versus attention groups, move/resize/reopen behavior, and issue-to-Passage/field navigation.                                 | Drydock remains the sole source of validation issues and error-versus-warning severity.                                                |
| Module boundaries       | Added `studio-types`, `StudioStatusHeader`, `StudioCommandPalette`, `StudioSelectionToolbar`, and `StudioCanvasViewControls`.                                                                              | No domain, persistence, validation, variable, expression, or schema module was introduced.                                             |

## Files changed

- `src/components/studio/TaleEditor.tsx` remains the compatibility coordinator; it now wires extracted presentation modules and local view/selection state.
- `src/components/studio/studio-types.ts` centralizes Studio DTO/UI-shape types without redefining Chronicle contracts.
- `src/components/studio/StudioStatusHeader.tsx` owns status and command presentation.
- `src/components/studio/StudioValidationPanel.tsx` owns movable, resizable validation presentation and issue navigation.
- `src/components/studio/StudioCommandPalette.tsx` owns the accessible command dialog.
- `src/components/studio/StudioSelectionToolbar.tsx` owns contextual selection actions.
- `src/components/studio/StudioCanvasViewControls.tsx` owns local view controls.
- `src/animation/presentation/story-motion.ts` defines the finite Shipwright preset vocabulary consumed by existing presentation fields.
- `src/styles/studio.css` adds responsive command, selection, validation, and canvas-control styling.
- `src/styles/chronicle.css` renders the finite presentation presets in previews and published journal leaves.
- `src/components/studio/TaleEditor.test.tsx` adds whole-card selection, animation-control, severity, and validation-reopen coverage.

## Explicit non-changes

- No Prisma schema, migration, generated-client, or data correction change.
- No new Story Block type, field, schema version, variable, expression, validation rule, simulator rule, runtime progression rule, or publish contract. The animation controls map only to pre-existing journal presentation fields.
- No change to protected-media authorization, Creator authorization, CSRF, autosave versioning, conflict behavior, immutable publication, version comparison, or Lanternwake ownership.
- No provider-secret, environment, deployment, or production-state change.

## Accessibility and responsive behavior

- The command palette is a labelled modal dialog with focused search, Escape close, and return focus.
- Canvas cards are keyboard reachable; Enter/Space follows the same selection path as pointer activation.
- Existing dnd-kit remains the drag and keyboard-drag transform owner. Motion remains outside that transform owner.
- Selection and canvas controls wrap on narrow screens; the existing small-screen Library/Inspector behavior remains intact.
- Motion is not added to the view controls; existing reduced-motion handling remains authoritative.

## Phase boundary

This is Phase 1 only. Contract-aware block editors, variable/expression authoring, new validation meaning, new Story Block semantics, graph changes, and any persistence design remain Phase 2-or-later work and require a fresh accepted-main branch plus their owning authority.

## Acceptance-repair closure

Implementation is `COMPLETE`. The exact integrated-source acceptance candidate `d7f3d0a2c9889134919402b8338f9df5095c657f` received the hosted Sounding Line mainline `RELEASE_GO` decision in run `31568707098` (plan digest `84d5ea51cd6301b95409b11aa4884914ebc0ebc068a1f0fce830c43dbf38aaef`; evidence digest `b7dbe23b6a9d55af528323a03ab3f8d2dd4ea7f213d8855b616f3bc9558df07b`). This repair includes no Phase 2 implementation.
