---
title: Parallax Phase 3 workspace ergonomics refinement
audience: product-engineering
status: implementation-in-progress-owner-review-required
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

The layout and Studio component checks passed during development. Real production-browser qualification, measured viewport-area comparisons, desktop/tablet/mobile captures and the owner's final visual decision remain pending. The browser journey covers the six requested sizes, actual drag-and-drop, edits, timeline changes, dock resizing, canonical save/reload, layout reset, keyboard focus, reduced motion and truthful unavailable AI.

New evidence belongs under `artifacts/parallax-phase3/workstation-refinement/`. Earlier owner-approved captures remain under `artifacts/parallax-phase3/workstation/`; they are preserved as the visual baseline. No ordinary final Sounding Line, protected integration, landed smoke, deployment or physical qualification is claimed by this record.

Documentation classification: current engineering evidence under `Development_Docs`; the Creator guide remains human product guidance and `.agents/parallax-phase3.md` remains active automation context. Full Phase 3 implementation and qualification remain in progress, so the completed Feature Catalog remains unchanged at this checkpoint.
