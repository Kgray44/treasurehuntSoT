---
title: Parallax Phase 3 workspace ergonomics refinement
audience: product-engineering
status: owner-approved-software-qualified-mainline
canonical_for: parallax-phase-3-workspace-refinement
last_reviewed: 2026-10-11
---

# Spatial-first workspace refinement

The owner approved the shown workstation experience at candidate `01de94c6`, then required an additional information-architecture refinement. Preserve the 3D renderer, assets, canonical editing and futuristic identity. The new layout must give the environment substantially more space and make supporting tools contextual. Approval of the earlier captures does not constitute approval of this refinement.

## Implemented presentation model

Spatial Editing starts with a compact asset rail, contextual Inspector, collapsed bottom dock and Ask Parallax command bar. Scene Construction expands the shared Library/Hierarchy/Saved dock. Behavior Authoring expands the timeline and prioritizes selected-object behavior. Focus / Immersive collapses both side docks and the bottom dock. These layouts use the same draft, selection, history, renderer and serialized autosave.

Library, Hierarchy and Saved Items are separately scrolling tabs that stay mounted, preserving filters and selection. Side docks resize from 210–420 pixels. Inspector accordions separate identity, placement, transform, appearance, interactions, behavior, accessibility/fallback, reuse/publication and Engineering. Mode changes prioritize readable tasks, richer transforms or precise anchor/coordinate details. Scene validation and immutable publication remain existing canonical actions.

The bottom dock provides Timeline, Simulation, Diagnostics and transient Events views, a persistent compact playback strip and a 160–460 pixel pointer/keyboard resize handle. It releases its full body area when collapsed. The existing renderer's ResizeObserver updates its drawing size and camera projection without remounting the scene. Narrow displays use temporary side drawers and start with nonessential panels closed.

Ask Parallax opens a bounded floating workspace or docks into the center. Supported phrase preview, review/apply/discard and configured intent/critique retain their existing behavior. Provider-unavailable status remains explicit. This does not implement or qualify the separately owned Assistant A1 provider/operation-bundle feature.

Account-scoped browser preferences retain dock state, bounded dimensions, workspace layout, tabs, Inspector sections and Assistant docking. These contain no authored scene, physical scan, release revision or Chronicle content. Reset Workspace Layout restores a known-good Spatial Editing arrangement. Search/filter inputs remain mounted when switching tabs. Slash opens the command surface; Escape returns focus; Ctrl/Cmd-backslash switches focus layout; Ctrl/Cmd-Z and redo use canonical history outside text editing.

## Validation and review

The owner explicitly answered **Approve the refined workstation** for candidate `592217e3edb214bab76373dc64cbe4b954ba3703`, tree `36cb8d072caa7c17519d6398bd994c26c4c4a05f`, on 2026-10-11. This closes the refinement visual decision, separately from the earlier baseline approval. It does not certify physical placement or the separately owned A1 assistant.

Both production-browser workstation journeys passed against `26e895c42247104bb5ffb9b2f21c199244893005`: 10.0 seconds for adaptive docks and 11.7 seconds for populated 3D editing. Later changes through the approved `592217e3` affected browser-test handling of persisted Inspector state, separate Creator/Player authority and exact current-source Suite selection; the renderer and workstation UI are unchanged. The fixed-scene publication journey passed at `5e98f1c8`. The extended adaptive journey passed at `592217e3` in 51.6 seconds, including field review/refinement and immutable Chronicle republication.

The workstation journeys exercise drag-and-drop, pointer gizmo editing, Undo/Redo, camera navigation, timeline editing/playback, repeated dock resizing, shared-tab filter/selection retention, persistence/reload/reset, predictable collapse/Assistant focus, reduced motion and honest unavailable AI. All six requested sizes have real captures, no horizontal or vertical document overflow, and the same renderer DOM node across layout changes. Desktop/mobile axe checks have no serious or critical findings. The relevant subsystem check passed 165 tests across 17 files before the final shared field-scenario bindings; final qualification remains separate.

## Measured usable viewport

These are actual renderer CSS-pixel bounds with the exercised, resized dock preferences. Focus gains compare against the expanded Construction layout at the same browser size. Supporting drawers overlay temporarily on tablet/mobile, so their layouts retain the same renderer bounds; this does not claim the open drawer leaves the scene unobstructed.

| Browser     | Construction | Spatial Editing | Focus      | Focus area gain   |
| ----------- | ------------ | --------------- | ---------- | ----------------- |
| 1920 × 1080 | 1270 × 754   | 1570 × 754      | 1814 × 754 | 42.8%             |
| 1440 × 900  | 790 × 574    | 1090 × 574      | 1334 × 574 | 68.9%             |
| 1366 × 768  | 716 × 442    | 1016 × 442      | 1260 × 442 | 76.0%             |
| 1280 × 800  | 630 × 474    | 930 × 474       | 1174 × 474 | 86.3%             |
| 1024 × 768  | 924 × 442    | 924 × 442       | 924 × 442  | temporary drawers |
| 390 × 844   | 302 × 504    | 302 × 504       | 302 × 504  | temporary drawers |

At 1920 × 1080 the Spatial Editing canvas occupies 81.8% of browser width, and Focus occupies 94.5%. Earlier approved 1680 × 1050 capture bounds are approximately 1080 × 455; that is an image-based estimate, not an earlier DOM measurement. The new 1920 measurements must not be presented as a same-size before/after comparison. Measured data is `artifacts/parallax-phase3/workstation-refinement/viewport-measurements.json`.

## Running owner review

The owner-reviewed application is available at `http://localhost:62619/studio/parallax?definition=2146f777-4394-4661-bfbe-03c89a9c3d6f` while its task-owned runtime remains running. It uses a disposable synthetic database cloned from the populated workstation fixture, ordinary password sign-in, no configured external providers and loopback binding. Runtime ownership, source/tree/lock hash and synthetic login proof are retained in `artifacts/parallax-phase3/owner-review/`. The process/port belong to this task; preserve them during owner inspection. A running process is not physical-device proof.

New local evidence remains under `artifacts/parallax-phase3/workstation-refinement/`. Earlier owner-approved captures remain under `artifacts/parallax-phase3/workstation/`; they are preserved as the visual baseline. The [Phase 3 implementation record](Phase_3_Implementation.md) now establishes ordinary Sounding Line, protected PR #711 integration and landed smoke, and preserves source-bound captures and measurements in the engineering evidence directory. Deployment and physical qualification remain unperformed.

Documentation classification: current engineering evidence under `Development_Docs`; the Creator guide remains human product guidance and `.agents/parallax-phase3.md` remains active automation context. The [full Phase 3 implementation record](Phase_3_Implementation.md) reconciles the completed local capability and remaining ordinary protected qualification.
