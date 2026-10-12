---
title: Parallax named rooms, surfaces and orientation
audience: product-engineering
status: implementation-validation
canonical_for: parallax-room-surfaces-correction
last_reviewed: 2026-10-12
---

# Named rooms, surfaces and snapping

The Creator needs a wall-mounted clue to face the wall normal and a tabletop
substitute to lie on that table. Manual placement must be distinct from automatic
room resolution, and the Surfaces view must describe current room geometry.

The renderer and discovery share `room-geometry.ts`. The floor is one complete
plane, each modeled wall is one complete plane, and desk/table/shelf/sofa planes
use their actual dimensions and positions. Changing, adding or removing geometry
changes discovered faces without registering a separate placement patch. The
sofa is shown as blocked; free-space and walkway regions are not presented as
physical surfaces. The synthetic floor has a separate safe furniture-side
staging offset; its outline still covers the whole floor.

The accessible Surfaces picker places a selected object and aligns its authored
face to the plane normal. Moving a manual object within 18 cm of a fitting safe
plane also snaps and aligns when Snap is enabled. Object scale is retained;
oversized, outside-face, obstructed or locked edits are rejected. These ordinary
history edits make no AI request. Undo, Redo and saved restoration preserve the
selected plane and orientation.

Manual snapping requests the correct horizontal/vertical native anchor alignment.
Bounded optional synthetic preview frames retain the editor's selected surface
without baking invented room coordinates into the native plane-relative pose.
Native measured frames remain authoritative. Existing drafts and published
checksums without these optional fields retain their parsed representation.

Enabling automatic placement preserves a vertical preset's wall preference.
Choosing another surface uses surface-relative orientation. An older wall recipe
using upright orientation also lies flat on an allowed horizontal substitute.
Explicit upright tabletop and player-facing intent remain supported.

The surface picker explains manual versus automatic placement. The Inspector
also names the current method and explains what Move, Rotate and Scale do.
Existing authoring modes and the Assistant's blue overlay remain intact.

## Distinct synthetic environments

Bedroom and Small dorm have differently sized beds, storage and study areas.
Living room has a sofa, armchair, coffee table, rug and television. Office has
four computer workstations and a filing cabinet. Classroom has rows of desks,
chairs and a teaching whiteboard. Gallery has framed art, display plinths and
a bench. Outdoor trail has a path, trees, stones and signage. Plaza has benches,
planters, lighting and a central fountain. Empty room contains only its shell.
Cluttered room has stacked obstacles. Room-specific geometry drives both
rendering and surface discovery; decorative and curved shapes are not invented
planar supports. Known furniture footprints exclude floor placements underneath
objects. Changing environment resets the camera to frame that scene.

## Verification boundary

Focused geometry, orientation, anchor, history and canonical domain tests precede
the isolated production-browser journey. The current contract retains the
floating-window journey and adds a rendered surface-picker/snapping outcome.
Protected capture, independent visual review, ordinary Sounding Line and landed
smoke remain required before integration. Owner acceptance is not claimed.

This correction covers existing synthetic rooms. It does not implement
photo-to-room reconstruction, arbitrary imported mesh reconstruction, curved
surface detection, or physical AR qualification. The owner explicitly selected
existing-room correction first on 2026-10-12. Future room reconstruction must
provide actual geometry and measured evidence through the existing domain seam.

Feature Catalog decision: the named-environment expansion materially improves the
existing synthetic simulation capability. FT-B092 records distinct furnished
reference environments and shared geometry-driven surface discovery.
