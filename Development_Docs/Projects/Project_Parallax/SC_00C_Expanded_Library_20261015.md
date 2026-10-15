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

The first integrated production candidate `15ac68611bf5d6ec2e14f025ea76653992984eb3`
passed two task-isolated Chromium journeys: compact to expanded to checked
placement and back, then narrow/phone, light theme, reduced motion and catalog
error recovery. The browser run used synthetic accounts and a task-owned SQLite
database. Visual inspection of its narrow screenshot found the gallery pushed
too low and a footer collision. The layout correction and additional Scene
Manager/publication details are under a fresh combined rerun; the first run is
retained as an intermediate observation, not final visual acceptance.

Protected Product Experience planning still requires the separately owned
Crossdeck Phase 2 design contract. The Parallax integration candidate and
SC-07A publication candidate have been combined locally for this checkpoint.
No protected merge, owner acceptance, live photo accuracy or physical AR
qualification is claimed here.
