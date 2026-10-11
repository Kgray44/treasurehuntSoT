---
title: Parallax Phase 3 workstation design review
audience: product-engineering
status: owner-visual-approved-phase-3-in-progress
canonical_for: parallax-phase-3-workstation-review
last_reviewed: 2026-10-11
---

# Spatial Studio workstation correction

The owner rejected the previous form-led Spatial Studio design. The updated owner objective requires an independent futuristic workstation, a dominant interactive 3D viewport, populated scenes, actual editing/browser evidence and explicit owner visual approval. Phase 2's software integration does not establish acceptance of its appearance. This correction extends the existing `/studio/parallax` workspace and preserves its draft, library, version, validation and Chronicle attachment architecture.

## Implemented candidate and initial browser evidence

Candidate `abacc30d564b9af3de68c549bb2761e9af00d930` introduces a Creator-only Three.js renderer with cutaway synthetic rooms, procedural furniture, window/light presentation and distinct map, letter, writing, footprint and compass representations. No camera capture, recognized surface, measured room, physical tracking or real-device qualification is inferred from these models. Native Lens transport retains its accepted renderer boundary.

The viewport supports camera orbit, pan and zoom; perspective, orthographic plan and elevation views; object selection; translation, rotation and uniform-scale gizmos; world/local coordinates; snapping; surface/safety overlays; and keyboard/precise inspector alternatives. Locked and nonselectable entities remain protected. Adaptive translation changes reviewed semantic surface intent rather than adding an arbitrary coordinate offset that could bypass safety. Transform commits use the existing inverse-parent-frame conversion and reversible draft history.

The asset browser provides visual previews, search and categories for the supported built-in assets. Adding an asset extends the current definition and preserves its identity; **New scene** creates a separate draft. Imported models, audio, effects and portals remain unavailable without a qualified renderer. Guided, Detailed and Engineering modes edit the same canonical definition. Dock collapse and resizing are presentation state only.

The behavior timeline provides bounded visual event tracks, seeking, playback and editable event delays. Spatial state changes use the existing declarative behavior evaluator and never emit authoritative Chronicle progression. Contextual assistance provides a transient proposal preview followed by explicit approval or discard. Supported phrase rules disclose their limits and do not impersonate an unconfigured model. Configured AI intent/critique retains the existing strict proposal boundary. A separately owned Assistant A1 integration has a proposed host seam in the active automation packet; its broader provider/operation-bundle workflow is not claimed here.

The isolated production browser run for the initial candidate passed both journeys in 57.9 seconds:

- Populated workstation: normal authenticated opening, asset insertion, precise edits, camera movement, perspective modes, safety overlays, timeline playback, proposal preview without modifying the saved draft, dock collapse, progressive modes and constrained layout. Desktop and constrained accessibility checks found zero serious/critical violations.
- Adaptive Creator/Player: multi-object remote authoring, immutable release/attachment, canonical Chronicle publication, pinned reopen, Guided Lens recovery, optional consented synthetic feedback, retry after an aborted network request, withdrawal and preserved authoritative progression.

Original log: `parallax-workstation-browser-abacc30d.log`. Owned runtime receipts remain under `artifacts/sounding-line/generic-abacc30d564b/`. Captures are under `artifacts/parallax-phase3/workstation/`; pre-change comparison captures remain under `artifacts/parallax-phase3/baseline/`. The earlier `bd198185` run passed retained Studio/Lens cases but its new adaptive case failed an incorrect environment locator; original evidence remains under `artifacts/parallax-phase3/first-browser-failure/`.

Capture review identified scrolling dock headers and a timeline that could show property forms instead of tracks. Candidate `01de94c67ed82d0812db6f884389e0b0fc52d274`, tree `ad973669b87803647932745f194e33be25a5670a`, separates dock scrolling, makes sequence properties expandable, uses the immersive shell and improves scene framing. Its isolated production workstation journey passed in 9.4 seconds: dragging the rendered X gizmo changed the inspector transform, and Undo restored it. Camera navigation, timeline playback, transient preview, dock collapse, modes and desktop/constrained accessibility checks passed. Log: `parallax-workstation-browser-01de94c6.log`; receipts: `artifacts/sounding-line/generic-01de94c67ed8/`. The actual interaction video is `artifacts/parallax-phase3/workstation/interaction-walkthrough.webm`.

## Owner visual approval received; Phase 3 closure remains open

On 2026-10-11 the owner answered **"Approve this workstation experience"** after viewing the populated desktop and constrained captures for candidate `01de94c6` and its verified interactions. This satisfies the updated objective's visual approval gate for the shown experience. Captures: `artifacts/parallax-phase3/workstation/desktop-primary.png` and `constrained-viewport.png`.

The complete Phase 3 software closeout remains in progress. No ordinary final Sounding Line receipt, protected merge, landed smoke, deployment, Assistant A1 approval or physical qualification is claimed. Preserve the approved design while completing these distinct requirements.

Documentation classification: this file is current engineering evidence under `Development_Docs`; the Creator guide is human product guidance; `.agents/parallax-phase3.md` is active automation context. The completed-feature catalog remains unchanged while Phase 3 implementation and qualification are incomplete.
