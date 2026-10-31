---
title: Photo room orientation and chair-facing audit
audience: product-engineering
status: in-progress
canonical_for: parallax-room-orientation-audit-20261013
last_reviewed: 2026-10-14
---

# Orientation evidence and chair-facing audit

The [user development overview](Spatial_Studio_User_Development_Overview.md)
explains current reconstruction checks, model comparison and remaining fidelity.
The latest private 43154267 independent review has immutable SHA256
`387638b2ca35ff47752dcbf8196b1f9af085471019cf79e4744324510100a458`.
It verifies workflow and transform propagation only: observed cabinet facing is
more plausible, but table heading varies between revisions and chair count/side
and generic construction fidelity remain approximate. This is not a controlled
repeatability study or photographic/physical acceptance. Original review bytes
and all owner photo/room artifacts remain ignored and private.

The [fresh two-photo Sol check](Fresh_Two_Photo_Check_20261014.md) resolves the
specific earlier right-table axis discrepancy in that captured sample and
improves identifiable seating correspondence. It does not close cropped seating,
generic furnishing construction, cross-run consistency or physical fidelity.
Earlier failed receipts and private reviews remain unchanged.

This record continues the existing reconstruction work. Owner photographs and
derived room geometry remain in ignored private artifacts. No room-specific
coordinate or table-rotation patch is part of these changes. Astra remains excluded.

## General corrections

Table/desk confidence is limited by supported edge evidence. Missing evidence or
an unresolved view cannot promote an estimated heading above 0.6 confidence.
A clear second view can still resolve a cropped first view. Confident contradictory
edge evidence is rejected; estimated width, depth and yaw are not silently changed.
Confidence remains evidence metadata, not calibrated physical accuracy.

The observation instructions now identify both tabletop edge families and separate
the support table outline from equipment sitting on it. Reference-wall and floor
layout instructions avoid assumptions about classroom layouts, table counts, rows,
or symmetry. These instruction changes are an experiment, not an established
general reconstruction-quality improvement.

The fresh joint observation exposed a deterministic chair-facing defect: every
chair was forced to aim at the exact table center, even if its observed forward
direction already intersected the table footprint. For an off-center chair near a
wall, that swivel could produce an invalid room. The mapper now preserves a valid
observed heading, using a ray intersection with the table's oriented footprint.
It resolves toward the center only when the heading misses the table. Position and
dimensions remain unchanged, and ordinary containment/collision verification stays
authoritative. Synthetic regression cases cover five table rotations, an off-center
wall-side chair and rejection of genuinely out-of-bounds furniture.

## Low reasoning experiment

At `8c536df58276a3d326d2544a4a6cb6d99f695bbd`, two guarded Sol calls used
the same owner-authorized photographs, no required measurement, low reasoning and
an 8,000 output-token limit. The one-photo UI journey passed admission, renderer
footprint checks, save/reload, optional scale, Undo and permission withdrawal.
The two-photo result returned geometric clarification after the unwanted chair
swivel; no substitute geometry was applied. The failed receipt is preserved.

The calls settled USD0.0501985 and USD0.0557333, total USD0.1059318. Both outcomes
are accounted for, including the rejected room. Prior unresolved exposures remain
reserved. Combined local settled accounting is USD1.390947765; the conservative
combined maximum after these settled calls is USD3.448947765, below the USD5 ceiling.
These are local accounting records, not a provider invoice.

The disputed table heading remains in the model observation, rather than arising
from a width/depth swap or renderer rotation. The new one-photo sample also differs
from its joint sample in a central table heading and visible chair count. One sample
per cell cannot distinguish prompt effects from stochastic model variation or prove
that the photos lack sufficient information. No universal quality claim follows.

Replaying these exact retained observations through the chair-facing correction
produces valid proposals without another inference call. Retained-observation
browser audits are explicitly labeled replay; they test mapping, actual rendering
and reload, not a new vision inference or physical-room accuracy. The replay inputs
and resulting room captures remain private and are never documentation fixtures.

## Continuing comparison

A separate guarded Sol medium-reasoning study uses at most two calls and USD0.268
reserved exposure. Current instructions, strict schema, photos and image consent
remain the same. The comparison tests whether additional reasoning helps; it does
not change the default model/reasoning setting automatically. There are no retries
or Astra escalation.

The study at `72968baec1c28b289851bc4e2e15ee1c55d8e94d` returned two paid
responses. One photo was rejected for overlapping equipment; two photos passed
the full bounded UI walkthrough. Neither joint sample changes the disputed table
heading. The medium one-photo observation changes that heading but disagrees with
its joint sample and cannot be admitted as a valid room. This does not establish
medium reasoning as the better general setting, so the default remains unchanged.

| Setting | Photos | Settled USD | Generation seconds | Initial UI outcome                                                    |
| ------- | -----: | ----------: | -----------------: | --------------------------------------------------------------------- |
| Low     |      1 |   0.0501985 |             60.982 | Pass                                                                  |
| Low     |      2 |   0.0557333 |             67.919 | Chair-facing clarification; retained replay succeeds after correction |
| Medium  |      1 |   0.0699885 |            100.072 | Equipment overlap clarification                                       |
| Medium  |      2 |   0.0839308 |            119.012 | Pass                                                                  |

Four new calls settle USD0.2598511. Combined local settled accounting is
USD1.544867065; the conservative combined maximum including earlier unresolved
exposure is USD3.602867065. The original USD5 ceiling remains in force. No further
calls or automatic retries are part of this comparison. Higher reasoning uses
more output tokens and time here without resolving the joint heading discrepancy.

Production scanner, physical scale/fidelity, Safari world tracking and owner room
acceptance remain separate outstanding requirements. See the
[overhaul checkpoint](Spatial_Studio_Overhaul_20261012.md) and
[privacy-reviewed API examples](OpenAI_Request_Response_Examples.md).

## Chair-side and supported-stack continuation

At `15afd58e4250cf920865656d8b7874210e7fe54f`, general instructions and
validation add independent per-view chair-side evidence, preserve tucked chairs
when actual solids remain clear, and permit observed stacks on real modeled
support tops. Square and rectangular tables retain independent image-estimated
width and depth; no fixed aspect ratio or room-specific coordinate fix is used.
Unsupported or contradictory chair-side evidence lowers confidence or requests
clarification instead of moving seating to satisfy a guessed layout.

Two new guarded Sol-low calls settled USD0.059976 and USD0.065352. Both bounded
one-photo/two-photo UI walkthroughs passed with VALID source binding. The joint
sample still gives the disputed right table a 90-degree heading; this has not
been established as solved. Successful admission, rendering and persistence
do not establish room fidelity. Owner ultrawide capture information is evidence
about the source camera, not proof that distortion caused the heading failure.
No lens-value input or lens correction is implemented; the owner deferred both.

All six new study calls total USD0.3851791. Current combined settled accounting
is USD1.670195065; the conservative combined exposure, retaining earlier
unresolved reservations, is USD3.728195065. The USD5 ceiling remains in force.
No Astra calls or further automatic retries occurred in this continuation.

The prior independent private room review returns REPAIR_AND_RECAPTURE for
orientation and seating fidelity (PX-ROOM-ORIENT-01, PX-ROOM-ORIENT-02 and
PX-ROOM-CHAIR-SIDES-01). Its immutable SHA256 is
`0a748009e292368df2660851968fc674abb26f8968293bfb51c25f714dd7a9db`.
The original photographs, observations, derived geometry and review stay in
ignored private artifacts. The latest chair-side experiment needs separate
quality review. One-/two-photo agreement and universal accuracy remain unproved.

## Latest independent chair-side review

The private 15afd58e review remains REPAIR_AND_RECAPTURE. Its immutable SHA256 is
43cd1f1920219c37c2a5ec9fb613f4db5f594b960c6e09f740c2f06e4fea1bf6.
Two-photo chair-side distribution changed partially, but seating fidelity is not
closed while table axes remain disputed. All actual rendered table and chair
bounds matched canonical geometry; successful proposal/save equality does not
establish correspondence with the original room.

PX-ROOM-FITTED-DISCLOSURE-01 identified a real feedback defect: a bounded estimated
chair adjustment was appended after the twenty-four-warning review cap. At
8d267b8d, fitted-placement warnings are prioritized. A saturated synthetic review
regression passes without changing coordinates, dimensions or collision policy.
No new paid inference was used for this correction. Original private evidence
remains immutable and outside Git. Current reconstruction fidelity is still open.
