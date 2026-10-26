---
title: Spatial Studio actual interface owner review
audience: product-engineering
status: captured-pending-owner-review
canonical_for: spatial-studio-visual-baseline-20261011
last_reviewed: 2026-10-11
---

# Spatial Studio visual review

These are real Chromium screenshots of the production-built application at **`f458bf2dc1176016c2d166180f038f0f15ac9f7c`**. The capture harness and contact-sheet generator add evidence only; the product source is unchanged. The ordinary isolated generic browser runner created its own SQLite database, loopback ports and account sessions. No real account, Chronicle, camera, external media or AI provider was used. The capture journey passed 1/1, including rendered-state, persisted API, version, mode and viewport assertions. This is an owner-review baseline; **owner visual acceptance remains pending**.

[Open the contact sheet](../../../Experience_Images/Spatial_Studio_20261011/contact-sheet.png). Individual originals retain their complete page resolution and can be zoomed independently. [Capture metadata](../../../Experience_Images/Spatial_Studio_20261011/captures.json) records each viewport, title and source identity.

## Captured states

| Original screenshot                                                                                   | Actual state                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Initial workshop](../../../Experience_Images/Spatial_Studio_20261011/01-unsaved-workshop.png)        | Unsaved Desk Map with empty owned library; the supported initial state is not an empty canvas.                       |
| [Guided desktop](../../../Experience_Images/Spatial_Studio_20261011/02-guided-desktop.png)            | 1920 × 1080 viewport, populated persisted scene, selected chart, inspector, presets/library, hierarchy and timeline. |
| [Detailed](../../../Experience_Images/Spatial_Studio_20261011/03-detailed-desktop.png)                | Layer audience, selectability/tags and asset/dependency disclosure.                                                  |
| [Engineering](../../../Experience_Images/Spatial_Studio_20261011/04-engineering-desktop.png)          | Numeric x/y/z, coordinate-frame details, canvas axes and engineering data.                                           |
| [Interaction preview](../../../Experience_Images/Spatial_Studio_20261011/05-scene-preview.png)        | At 2.5 seconds, inspection reveals a concealed note and a timer highlights the directional marker.                   |
| [Guided fallback](../../../Experience_Images/Spatial_Studio_20261011/06-guided-fallback.png)          | Readable camera-free chart, note and bearing content.                                                                |
| [Validation](../../../Experience_Images/Spatial_Studio_20261011/07-validation.png)                    | Real Drydock height-review warning and ten synthetic environment results.                                            |
| [Library version workflow](../../../Experience_Images/Spatial_Studio_20261011/08-version-library.png) | Immutable version created through the real authorized API; versions and attachment guidance.                         |
| [1440 desktop](../../../Experience_Images/Spatial_Studio_20261011/09-desktop-1440.png)                | 1440 × 900 viewport with all page content retained.                                                                  |
| [Tablet](../../../Experience_Images/Spatial_Studio_20261011/10-tablet.png)                            | 768 × 1024 viewport, stacked panels and bounded scrolling library.                                                   |
| [Phone](../../../Experience_Images/Spatial_Studio_20261011/11-phone.png)                              | 390 × 844 viewport, no horizontal document overflow; full 5451-pixel page.                                           |
| [Reusable letter](../../../Experience_Images/Spatial_Studio_20261011/12-reusable-library.png)         | Existing reusable letter, immutable v1, editable presets, category, collection and version controls.                 |
| [Restricted access](../../../Experience_Images/Spatial_Studio_20261011/13-restricted.png)             | Real unauthenticated Creator authorization route.                                                                    |

## Supported synthetic scene

[Chronicle attachment](../../../Experience_Images/Spatial_Studio_20261011/14-chronicle-attachment.png) shows the exact immutable release attached through the real Creator workflow. [Publication review](../../../Experience_Images/Spatial_Studio_20261011/15-publication-review.png) shows the real publication surface and its outstanding Drydock/Sea Trial prerequisites. Those records belong only to the synthetic Chronicle. Contact-sheet tablet/phone thumbnails are labeled top excerpts; individual originals retain the entire page.

**The Captain's Hidden Chart** uses a surface-relative parchment chart on the reference desk, a parchment note and a small MARKER bearing artifact. Three declarative behaviors hide the note on entry, show it 500 ms after chart inspection and highlight the bearing after 2000 ms. The scene is stored as a real My Library scene template with tags, a collection, a favorite and an immutable release. Its camera-free fallback preserves every clue. The artifact is a supported marker, not a fabricated 3D brass model; there are no unloaded external assets. The capture additionally persists and releases a reusable Peeking Letter preset.

## Visual findings

- The dark teal, gold, parchment and serif title fit Voyagewright's established nautical materials. The real Creator shell and navigation remain present. Local Studio colors are fixed rather than drawn from the product theme switch.
- The spatial canvas dominates the desktop center and includes orbit, elevation, zoom, selection and keyboard/drag affordances. Its bounded planar renderer shows simple rectangles/markers rather than detailed map textures or 3D objects. Long entity names overrun these small primitives and overlap nearby labels; this is an evident visual weakness, preserved for review.
- The hierarchy and timeline are useful and explicit. Three meaningful rules show source, trigger, delay, action and target. At 1920 × 1080 they sit below the initial viewport; the full screenshot preserves them. The inspector extends farther down than the canvas, leaving a tall document and unused center space.
- Guided exposes ordinary editing and meaning/fallback. Detailed adds layer/dependency controls; Engineering adds transforms, frame data and debug geometry. The differences are functional, although the additional form depth increases scrolling substantially (2656/3642/4006-pixel full-page captures).
- The Library is discoverable at desktop left, with five editable presets, owned items, scope/search and release/use metadata. This is an integrated sidebar rather than a separate rich catalog browser. Taxonomy and collection details sit in the inspector.
- Tablet and phone correctly stack panels and contain the library in a scrolling area. They passed horizontal-overflow checks, but phone editing requires substantial vertical navigation between the canvas, hierarchy, timeline and inspector. Software viewport evidence establishes no physical-touch usability acceptance.
- Empty library guidance is useful, but the actual initial editor immediately creates Desk Map. A truly empty scene is unsupported. Validation accurately separates synthetic environments from physical qualification; the fixture's height warning is visible rather than hidden for presentation.
- Immutable release controls are present. Full Chronicle attachment/publication requires opening from a Chronicle Passage; the baseline shows the truthful workflow boundary. Existing `parallax-studio.spec.ts` retains the qualified end-to-end attachment/Sea Trial/publication/reopen journey.

## Unavailable and pending evidence

Light-theme Studio, rich external asset rendering and a truly empty canvas are unsupported by this source. Transient loading is intentionally omitted in favor of complete rendered states. Live AI is unconfigured and shown unavailable. Physical AR tracking, real tablets/phones, representative-device owner walkthrough and subjective visual acceptance remain open. No Parallax Phase 3 work or redesign was performed.

The index, metadata and screenshots are engineering evidence. The capture test is validation code; the contact-sheet script is an evidence presentation helper. Navigation is linked from the Parallax home and the generated documentation inventory.
