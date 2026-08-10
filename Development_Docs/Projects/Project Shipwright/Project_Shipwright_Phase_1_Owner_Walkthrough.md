---
title: Project Shipwright Phase 1 Owner Walkthrough
audience: owner
status: ready-for-owner-walkthrough
last_reviewed: 2026-08-10
---

# Project Shipwright Phase 1 Owner Walkthrough

## What to review

1. Open an existing Studio Chronicle. Confirm the compact header still provides save state, undo/redo, Preview, Validate, Publish, and More.
2. Use **Commands** or `Ctrl/Cmd+K`. Search for `Validate`, `Preview`, `Library`, `Canvas`, `Inspector`, and an existing Passage type. Confirm the palette closes with Escape and returns focus to its trigger.
3. Select a Passage by pointer, Enter, or Space. Confirm the Inspector opens intentionally and its close button returns focus to the selected Passage.
4. Hold Ctrl/Cmd while selecting additional Passages. Confirm the selection shelf reports the count and offers only existing actions. Try moving a multi-selection to the following Chapter with a draft that has one.
5. Use Canvas Pan, Zoom out/in, and Fit canvas. Confirm they affect only the local authoring view and do not change passage order, content, or save state.
6. At desktop, tablet, and phone widths, confirm Library / Canvas / Inspector remain usable, controls wrap without overlap, and existing small-screen inspector behavior remains understandable.
7. Enable reduced motion and repeat the selection, command palette, validation, and publish-adjacent review. No success state should appear before the existing authoritative result.

## Acceptance boundary

This walkthrough is for interaction and presentation acceptance only. It does not authorize new Chronicle semantics, validation, publication, deployment, provider configuration, or production data changes. Full registered Sounding Line validation remains required before any release claim.
