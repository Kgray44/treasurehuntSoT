---
title: Project Shipwright Phase 1 Owner Walkthrough
audience: owner
status: accepted-with-post-review-corrections
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 1 Owner Walkthrough

## What to review

1. Open an existing Studio Chronicle. Confirm the compact header makes Save, Verifying, and Validation state obvious, while retaining undo/redo, Preview, Validate, Publish, and More.
2. Use **Commands** or `Ctrl/Cmd+K`. Search for `Validate`, `Preview`, `Library`, `Canvas`, `Inspector`, and an existing Passage type. Confirm the palette closes with Escape and returns focus to its trigger.
3. Select a Passage by pointer or Enter (or use its select control). Confirm the Inspector opens intentionally and its close button returns focus to the selected Passage; Space remains available for keyboard drag.
4. Drag a Passage from its title, copy, icon, or empty card space—not only the grip—and confirm its existing order changes correctly. Hold Ctrl/Cmd while selecting additional Passages, or Shift to select a range. Confirm the selection shelf reports the count and offers only existing actions.
5. In the Inspector, set opening, leaving, and active-state animation for a Passage. Confirm the ten finite choices include Fade, Chart slide, Expand, Minimize, Glide, Ink bloom, Lantern swell, Compass spin, Tidal wake, and Starlight fall; preview one and confirm reduced motion remains calm.
6. Run validation on a deliberately incomplete Chronicle. Confirm “Blocks publishing” is separated from “Needs attention,” the language explains the repair, the result window can move and resize, a finding opens its Passage/field, and closing/reopening works from the header.
7. Open the account menu from Studio and confirm it layers above the Studio top bar.
8. Use Canvas Pan, Zoom out/in, and Fit canvas. Confirm they affect only the local authoring view and do not change passage order, content, or save state.
9. At desktop, tablet, and phone widths, confirm Library / Canvas / Inspector remain usable, controls wrap without overlap, and existing small-screen inspector behavior remains understandable.
10. Enable reduced motion and repeat the selection, command palette, validation, and publish-adjacent review. No success state should appear before the existing authoritative result.

## Acceptance boundary

This walkthrough is for interaction and presentation acceptance only. It does not authorize new Chronicle semantics, validation, publication, deployment, provider configuration, or production data changes. Full registered Sounding Line validation remains required before any release claim.

## Recorded owner acceptance

The owner previously reviewed the Phase 1 Studio candidate and accepted it with a bounded correction list. Those corrections were implemented before the acceptance repair.

- `OWNER_REVIEW_STATUS: OWNER_ACCEPTED_WITH_POST_REVIEW_CORRECTIONS`
- `POST_CORRECTION_REPEAT_WALKTHROUGH: WAIVED_BY_OWNER`
- `OWNER_WALKTHROUGH_GATE: SATISFIED_BY_PRIOR_REVIEW_PLUS_EXPLICIT_WAIVER`

No second walkthrough or post-correction visual evidence is claimed. The authoritative Sounding Line finalizer remains the separate engineering release authority.
