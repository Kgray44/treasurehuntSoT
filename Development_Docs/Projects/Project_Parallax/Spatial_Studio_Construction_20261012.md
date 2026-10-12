---
title: Spatial Studio construction and independent verification
audience: product-engineering
status: implementation-in-progress
canonical_for: parallax-studio-construction-20261012
last_reviewed: 2026-10-12
---

# Strengthened owner objective

The supplemental environment-construction brief strengthens the
[active overhaul](Spatial_Studio_Overhaul_20261012.md). Ten recognizable layouts
are established by the earlier actual room captures. They are not yet accepted
as geometrically coherent, visually convincing reference constructions.

The same canonical editable specification must drive built-in and photo rooms:
complete architectural topology, physical wall/floor thickness, modeled
openings, reusable furnishings, support and semantic relationships, and
continuous outdoor terrain/path geometry. Confidence describes evidence; it
cannot certify geometry. Editor cutaways must remain display-only operations
on otherwise complete architecture.

# Independent engineering baseline

The new independent inspector consumes a completed part collection separately
from the input specification. It checks missing realized parts, continuous
whole-floor extents, boundary wall topology, ceiling presence, planar opening
attachment/bounds, furnishing containment, actual support contact, pairwise
oriented solid-box intersections and semantic support-face orientation.
Changing realized geometry while retaining a valid input specification produces
findings. Tests include omitted walls, displaced floors, invalid apertures,
confident but floating/detached objects, and a small object safely below a desk
versus actually intersecting its tabletop. Ground support uses the realized
floor height rather than assuming world Y=0 implies support.

The [baseline findings](../../Testing/Product_Experience/evidence/parallax-construction-20261012/baseline-findings.json)
retain all ten deterministic input specifications, exact entity/part findings,
the checkout identity and verifier/layout file digests. This is a working-source
engineering baseline, not source-frozen browser qualification or acceptance.
Every existing preset needs construction review. Indoor examples expose the
legacy two-wall shell and absent ceiling; windows are offset from the wall
plane. Some furnishings have missing supports or actual intersections. Outdoor
and assembled-structure findings need explicit topology/support relationships
and finer solid geometry before they can distinguish intentional joints,
rooting and mounted parts from inappropriate overlaps.

The baseline remains historical evidence. The rebuilt specifications now provide
four thick inward-facing walls, a ceiling, shared carved wall openings and
skirting, grounded furnishings, actual supported stacks and explicit mounted/
supported relationships. Empty Room retains only architecture. The trail has a
closed continuous terrain volume, level path strip, rolling banks and an explicit
walking corridor. Its sloped banks are excluded from planar attachment; the
editor does not advertise false horizontal supports on them.

The independent inspector now requires matching realized apertures, validates
declared support and mount contact, checks missing/unexpected parts, and samples
declared navigation for support and obstruction. A conservative trunk/elevated
crown model distinguishes low stones from a tree's semantic bounding box.
Creator room editing exposes exact-feature findings. Photo interpretation returns
clarification for invalid realized geometry regardless of confidence; saved Apply
rechecks the retained canonical proposal before the ordinary CAS save.

Current limitations remain explicit: solid-bound checks are not triangle-mesh
collision certification, comprehensive circulation or physical accessibility.
Photo clarification is not an editable invalid-proposal correction workflow.
General nonplanar attachment, arbitrary terrain reconstruction, realistic scale
qualification and final visual/performance acceptance remain open. A passed
subset reports CHECKS_PASSED rather than full construction certification.

The browser renderer pools unit geometry, materials and original small procedural
textures, instances repeated furnishing solids across features, and retains exact
instance-to-feature/part ownership. Architectural cutaways remain display-only.
Actual post-render bounds and renderer calls, triangles, geometry/texture counts,
CPU submission duration and backing resolution are emitted for isolated capture.
CPU submission duration is not GPU frame time. No renderer measurement or visual
acceptance is claimed before the source-bound browser run and independent review.

# Prop implementation awaiting visual qualification

Repository-authored parchment now has a closed front/back/edge volume in the
existing support-normal frame. Opened letter folds and map curls remain above
the support face; geometric checks verify closure and bounded thickness.
The compass has a modeled brass housing, dial, two-part needle, pivot and
transparent cover. Both retain existing selection/transforms/surface framing
and normal disposal. Their paper mesh is below 200 triangles and compass
below 2,000 triangles per instance. The dial and clue textures are original
512-pixel canvases; no external model/license or private source was imported.

These are implementation claims with geometric tests, not visual acceptance.
Actual comparative browser captures, correct readable placement, animation/
simulation regression, resource cleanup and renderer cost measurements are
pending. Existing native props remain simplified and are not requalified by
browser-only geometry. Full environmental fidelity and the owner's production
visual-quality requirement remain open.

# Verification and closure

Retain exact construction inputs as canonical benchmark fixtures. Test Empty
Room without furnishing interference, Cluttered Room with legitimate stacking
and ambiguous targets, and Outdoor Trail with a continuous navigable path.
Run independently inspected realized geometry for both presets and bounded
photo observations before admitting a proposal. Expose actionable findings at
the exact feature and retain ordinary history/save/reload correction.

After construction changes, capture all ten at comparable normal working sizes
and review actual recordings, selection, semantic queries, clamping, timeline,
simulation, persistence and measured rendering costs. Protected qualification,
native/physical readiness and owner acceptance remain separate gates.

## First production capture and repair

Candidate `d2db60f190bc0043b5cc459e7be6b4cede14f0ec` produced a source-valid
isolated production run. All forty room views and the ordinary delayed simulation
journey passed. Actual desktop counters were 21–107 render calls and 488–24,884
triangles, including renderer passes. The three-sample reset measurements retain
backing dimensions, memory counts and CPU submission time. These are bounded
software-renderer observations, not representative-device GPU performance.

The run was not wholly successful: two old browser assertions assumed the
legacy desk X=0.25 and eight surfaces, and the animation journey observed transient
phone overflow immediately after resizing. Those failures and all captures remain
in [the first construction packet](../../Testing/Product_Experience/evidence/parallax-construction-20261012/d2db60f190bc/run.json).
The repair derives fixture positions/counts from the canonical reference, waits
for the bounded viewport resize and caps canvas CSS width. No controls were
removed. Bedroom storage moves behind the primary work area to improve its actual
initial clue sightline; subtler wood grain and original gallery art/clock textures
add recognition without mesh proliferation. Recapture is required for the changed
source. Independent visual acceptance has not been assigned to this first packet.
