---
title: SC-00C Spatial Library refit implementation and validation
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-00c-spatial-library-refit
last_reviewed: 2026-10-15
---

# Spatial Library refit

SC-00C replaces Spatial Studio's separate asset and saved-content panes with one Library destination in the established left rail. Inside that destination, Assets, Environments, Scenes, Effects and Compositions are content filters. The Scene Hierarchy remains the other rail destination. The new catalog consumes SC-01 Environment/Scene records and SC-02's original asset/effect catalog; those branches retain ownership of their lifecycle and element contracts.

## Creator behavior

The Library supports name/description search, source and Environment filters, name/recent sorting, grid/list density, lazy asset thumbnails, and batches of 48 cards. Source labels distinguish built-in content, private creations and photo-reconstructed Environments. Saved Scenes and reusable compositions stay separate. Legacy saved drafts remain discoverable; a saved old-layout preference opens the Scenes category.

Selected cards expose descriptions, provenance and relevant metadata. Original SC-02 asset cards use their actual package thumbnails; legacy presets use their existing generated previews. Environment and Scene previews are derived from their saved geometry and objects. An Environment can reveal its associated Scenes or open SC-01's Environment manager without changing the Environment definition. A Scene can be opened, duplicated, renamed, organized, favorited or archived through the existing owner-scoped persistence and SC-01 lifecycle operations. Archived working records leave immutable versions and Chronicle pins intact. Saved compositions add an independent copy to the current Scene.

Assets and effects can be added by detail or context action and dragged into the viewport. Dragging a physical model previews the floor, table or wall target at the pointer and refuses a mismatched or out-of-bounds surface; supported effects retain their type-specific default and are selected for Inspector adjustment. The existing editor selects inserted objects and retains ordinary Undo/Redo. Existing semantic placement and Inspector controls remain authoritative. An unavailable asset is visibly marked preview-only and its add control is disabled. The Library does not offer a Community publish or install action until the governed provider exists; private Library and immutable Chronicle versions are explained separately from Community publication.

## Compatibility and boundaries

The catalog is a projection of existing records, not a second persistence service. SC-01 owns Environment revisions, Scene save/archive and version pins. SC-02 owns model/effect definitions and element insertion. SC-07A will own Community publication. Existing photo reconstruction, Environment creation choices, Scene Manager and Chronicle attachment continue through their current interfaces. The Library does not claim native or physical AR quality from browser proof.

## Verification

Focused catalog and Studio tests, TypeScript, production build, authenticated browser journey and responsive/keyboard/accessibility review are tracked on this branch. The browser journey must cover built-in search and insertion, Environment-to-Scene discovery, Scene management, composition reuse, large-catalog paging, mobile presentation and screenshots. Supporting evidence and exact source identity will be recorded here after execution. Protected Sounding Line qualification and owner acceptance are separate decisions.

The first production-browser attempt at `2778b08d652e9bf7db7c06c0f40f76fa47a7ed32` failed after its asset insertion/Undo/Redo checkpoint. The test used a brittle exact-label query for the Source combobox even though the browser accessibility tree exposed that combobox correctly. [Failed-run receipts and screenshots](evidence/sc-00c/20261015-initial-failed/run.json) are retained; the query and the clipped category navigation were corrected. This failure is not qualification evidence.

The [second production-browser run](evidence/sc-00c/20261015-local/run.json) passed on `f2eb62471e7fef5c26d3b3c928d6525e6060ecfb`. It exercised the authenticated Library search, original model thumbnail, add/Undo/Redo, owned Environment and associated Scenes, rename/collection/favorite/duplicate, saved composition insertion, 48-card paging and mobile axe serious/critical checks. Its 56 seeded Scenes and browser search observation were bounded test data, not a production load claim. Screenshot review exposed horizontal document overflow on the 390 px mobile layout; the next candidate constrains the mobile canvas and adds drag placement and parent-Environment navigation. That run is supporting evidence only and does not qualify the changed candidate.

The third browser attempt at `bcbbd2b58954e63accef47d94a7f4a1867bc3a48` stopped before exercising drag: its Playwright `has` filter incorrectly nested a Library-scoped locator inside each card. The [failed receipt and context](evidence/sc-00c/20261015-drag-locator-failed/run.json) are retained. The filter now uses a page-scoped descendant and a bounded action timeout; this is a test-harness correction, not proof of drag behavior.

The [fourth browser run](evidence/sc-00c/20261015-pass2/run.json) passed on `be22d1537caf32e3f80f6b8b3a741fe6482aa6c9`: an Effect was dragged into the viewport and selected, an incompatible floor asset drop was refused with visible feedback, parent-Environment navigation worked, the 390 px mobile document measured 390 px, and the Library axe check found no serious or critical violations. It measured 64.4 ms from browser search input to visible result in this bounded synthetic dataset. The next run adds a positive physical floor drop and checks its selected instance; this run remains a supporting local receipt and does not replace protected qualification.

The fifth attempt at `d34021001fc43a3112561a9afa66a7fc4869d974` stopped in the new physical-drop checkpoint before the drop event: its top-edge drag target was covered by the canvas header overlay, so Playwright correctly refused to release the pointer there. The [failed receipt, screenshot and browser context](evidence/sc-00c/20261015-physical-drag-target-failed/run.json) are retained. The test now targets unobstructed canvas pixels for both invalid and valid surface drops; this failure is not positive placement proof.

The imported SC-01 and SC-02 branches are still independently owned and unmerged. SC-00C's candidate is dependent on their exact source commits and cannot be treated as a Library-only mainline change.
