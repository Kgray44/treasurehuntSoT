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

Assets and effects can be added by detail or context action and dragged into the viewport. The existing editor selects inserted objects and retains ordinary Undo/Redo. Existing semantic placement and Inspector controls remain authoritative. An unavailable asset is visibly marked preview-only and its add control is disabled. The Library does not offer a Community publish or install action until the governed provider exists; private Library and immutable Chronicle versions are explained separately from Community publication.

## Compatibility and boundaries

The catalog is a projection of existing records, not a second persistence service. SC-01 owns Environment revisions, Scene save/archive and version pins. SC-02 owns model/effect definitions and element insertion. SC-07A will own Community publication. Existing photo reconstruction, Environment creation choices, Scene Manager and Chronicle attachment continue through their current interfaces. The Library does not claim native or physical AR quality from browser proof.

## Verification

Focused catalog and Studio tests, TypeScript, production build, authenticated browser journey and responsive/keyboard/accessibility review are tracked on this branch. The browser journey must cover built-in search and insertion, Environment-to-Scene discovery, Scene management, composition reuse, large-catalog paging, mobile presentation and screenshots. Supporting evidence and exact source identity will be recorded here after execution. Protected Sounding Line qualification and owner acceptance are separate decisions.

The first production-browser attempt at `2778b08d652e9bf7db7c06c0f40f76fa47a7ed32` failed after its asset insertion/Undo/Redo checkpoint. The test used a brittle exact-label query for the Source combobox even though the browser accessibility tree exposed that combobox correctly. [Failed-run receipts and screenshots](evidence/sc-00c/20261015-initial-failed/run.json) are retained; the query and the clipped category navigation were corrected for a new candidate. This failure is not qualification evidence.

The imported SC-01 and SC-02 branches are still independently owned and unmerged. SC-00C's candidate is dependent on their exact source commits and cannot be treated as a Library-only mainline change.
