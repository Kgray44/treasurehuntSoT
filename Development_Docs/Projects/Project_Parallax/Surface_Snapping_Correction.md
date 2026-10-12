---
title: Parallax named rooms, surfaces and orientation
audience: product-engineering
status: focused-validation-integration-blocked
canonical_for: parallax-room-surfaces-correction
last_reviewed: 2026-10-12
---

# Named rooms, surfaces and snapping

The Creator needs a wall-mounted clue to face the wall normal and a tabletop
substitute to lie on that table. Manual placement must be distinct from automatic
room resolution, and the Surfaces view must describe current room geometry.

The renderer and discovery share `room-geometry.ts`. The floor is one complete
plane, each modeled wall is one complete plane, and desk/table/shelf/furniture planes
use their actual dimensions and positions. Changing, adding or removing geometry
changes discovered faces without registering a separate placement patch. Soft seating, beds, storage and clutter are shown as blocked; free-space and walkway regions are not presented as
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

The focused Parallax suite passes 377 tests across 27 files, including geometry,
orientation, anchors, history and canonical compatibility. A fresh TypeScript
check passes. The original floating-window contract is preserved; a separate
rooms-and-surfaces experience contract records the new visible journeys.
The isolated production-browser run at `c4dc6659` passes four journeys with an
unpaid synthetic provider. Its [receipt](evidence/rooms-surfaces/c4dc66598e25/run.json)
and [browser log](evidence/rooms-surfaces/c4dc66598e25/browser.log) preserve exact
source identity. All ten presets have desktop and phone captures in both themes
(40 room screenshots), alongside manual wall/table/floor orientation, automatic
wall-to-table orientation, saved restoration and Assistant presentation checks.
The [independent local re-review](evidence/rooms-surfaces/c4dc66598e25/independent-local-review.json)
accepts the focused presentation across all 17 dimensions after direct inspection
of 47 screenshots and three hash-verified recordings. All five prior findings
are resolved. This is local review, not protected qualification. Protected capture, review attestation, ordinary
Sounding Line and landed smoke remain required before integration. Owner
acceptance is not claimed.

This correction covers existing synthetic rooms. It does not implement
photo-to-room reconstruction, arbitrary imported mesh reconstruction, curved
surface detection, or physical AR qualification. The owner explicitly selected
existing-room correction first on 2026-10-12. Future room reconstruction must
provide actual geometry and measured evidence through the existing domain seam.

Feature Catalog decision: the named-environment expansion is meaningful, but
protected integration remains blocked. The existing mainline FT-B092 fragment
is preserved until the expansion completes its required acceptance workflow.

## Protected integration blocker

The protected experience plan selects downstream product consumers because
published Chronicle parsing calls shared Spatial Authoring validation. It
requires a complete `crossdeck.phase2.continuity` experience design; the current
protected registry supplies only an intent and owner-reported baseline debt.
An exploratory complete design also exposed unregistered downstream account,
Player, Captain, community, Passport, Landfall and publishing screens. The
exploratory Crossdeck fixture and contract were removed; this room correction
does not introduce a partial Player refit or expand its completion claims.

The plan fails with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
No protected capture, review attestation, ordinary acceptance or merge is claimed.
The owned draft PR retains the implementation for review. Registering and
qualifying the affected downstream experiences is required before integration;
changing the protected authority or declaring false coverage is not a remedy.

The current product-status and feature-status documents were reviewed. Their
mainline availability claims remain unchanged while this draft correction is
blocked. The Spatial Studio and Assistant guides and Unreleased changelog
describe the branch behavior and its reconstruction boundary.

## Rendered repair evidence

The first independent review found landscape editing collapsed to a thin strip,
occupied tabletop placement, an obscured wall result and clipped room edges.
The `9d3a4e0d` [independent review](evidence/rooms-surfaces/9d3a4e0d01ad/independent-local-review.json)
confirms those four issues repaired, but identifies a new phone visibility
blocker: fixed fog hid the trail and severely faded the classroom when the
camera backed out to frame larger geometry. Four passing browser journeys did
not override that rendered finding.

The `c4dc6659` repair keeps finite rooms visible at every framing distance,
scales the camera clipping range and captures every named environment on
phones in both themes. The only subsequent product source cleanup removes an
unused import; screenshots and recordings remain bound to the actual built
candidate, rather than being claimed as a capture of a documentation successor.

A final read-only refresh found protected main at
`5117092984142ccdb96aeff5db90ea2e77a59357` (Reach PR #716). That delta changes
no Parallax domain or Studio component source. Its Crossdeck registry still
contains only the intent and baseline debt, without the required complete
experience design. The captured candidate remains on its frozen `5e72620c`
base; this check does not imply capture, qualification or integration of the
new mainline tree.

The final independent review has no blocking findings. Nonblocking observations
remain explicit: the phone surface picker covers part of the scene while open,
the internal floor-furniture identifier differs from the visible Entire floor
label, and peripheral phone overlays overlap small parts of large rooms. The
picker can be closed for editing and inspection; these observations do not
conceal missing room geometry. New owner acceptance remains unclaimed.
