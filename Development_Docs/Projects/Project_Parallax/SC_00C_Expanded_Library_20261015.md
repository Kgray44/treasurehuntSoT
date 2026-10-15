---
title: SC-00C expanded Spatial Library implementation checkpoint
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-expanded-spatial-library-20261015
last_reviewed: 2026-10-15
---

# Expanded Spatial Library

The compact left Library and expanded floating workspace render one mounted
`SpatialContentLibrary`. Search, category, source, collection, sort, selected
item, page cursor and exact detail reads remain in that component while the
presentation changes. Both modes call the same Scene, Environment, insertion
and Harborlight actions. Opening the workspace does not reinstall a Scene or
remount the viewport, so the camera, selected object, unsaved edits and Undo
history remain in Spatial Studio.

The expanded workspace has a content navigation column, paged thumbnail
gallery and contextual detail panel. A selected SC-02 physical model alone may
open a small interactive 3D inspector. It builds one procedural model without
full texture allocation, caps renderer pixel ratio and canvas dimensions,
renders only on resize or user rotation, and releases GPU resources when the
selection or presentation changes. Other content retains its canonical
thumbnail or semantic preview; no 3D bytes are loaded for every card.
Source, Show and Sort sit in a compact toolbar above the gallery instead of
occupying the left navigation column. On phones, Filters opens those controls
when needed, so content is visible immediately below search and category
navigation. Category tabs use arrow, Home and End keys and retain a visible
focus target.

**Place in Scene** for a physical asset closes the overlay and enters the
existing renderer's surface picker. The pointer highlights a safe compatible
support; keyboard users can choose an explicit safe room surface. An invalid
point inserts nothing and leaves placement active; Cancel inserts nothing.
Successful insertion uses the existing checked `insertSpatialElementInEnvironment`
edit, selection and Undo/Redo path. Classic authored presets retain their
separately labelled Add action.

Scenes and Environments remain definitions, not draggable physical objects.
Open and edit use the existing SC-01 callbacks. The expanded Create Scene from
Environment and Duplicate Scene actions open the canonical Scene Manager with
the selected source preselected. Exact release selection and duplication remain
Scene Manager operations. Harborlight's existing publishing dialog remains the
mutation path; selected owned items read their publication status from its
owner-scoped listing endpoint. Built-in, owned, installed and published statuses
are named separately. Installed releases remain read-only with license and
credit details.

## Validation boundary

The final local candidate `99738a6efb56e6c794bd91e841ca68542320e664`
passed two task-isolated production Chromium journeys: compact to expanded to
checked placement and back, then narrow/phone, light theme, reduced motion and
catalog error recovery. A separate combined run passed 18 Library, insertion,
Scene/Environment lifecycle and Harborlight Community cases on the same source.
Both runs used synthetic accounts and fresh task-owned SQLite databases. The
[source-bound captures and independent screenshot review](evidence/sc-00c/20261015-expanded-library/README.md)
show the compact toolbar and responsive states. An earlier candidate passed its
functional journeys but exposed a narrow-layout gap and footer collision; the
final capture repairs both. The independent re-review found no remaining
concrete blocker in the captured states. A separate fresh 2,000-Scene browser
case passed on the same source, with a 48-card first page and 96 cards after
Show more; its 6.6 MB full Studio bootstrap remains a scale limit. This is
bounded local product evidence.

Protected Product Experience planning still requires the separately owned
Crossdeck Phase 2 design contract. The Parallax integration candidate and
SC-07A publication candidate have been combined locally for this checkpoint.
No protected merge, owner acceptance, live photo accuracy or physical AR
qualification is claimed here.
