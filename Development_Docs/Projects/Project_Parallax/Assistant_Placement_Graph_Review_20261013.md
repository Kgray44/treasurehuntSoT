---
title: Assistant placement and Scene Graph correction review
audience: product-engineering
status: in-progress
canonical_for: parallax-assistant-placement-graph-review-20261013
last_reviewed: 2026-10-13
---

# Scope and findings

The owner reported a Bedroom wall note placed on the opposite window, implicit
group selection, inconsistent group floor clicks, fragmented floor visualization,
blocked clear floor, and insufficient Assistant request animation. These changes
extend the current owned Studio candidate; protected integration, comprehensive
Studio acceptance, reconstruction accuracy and physical Safari AR stay separate.

The visible built-in preset previously did not enter the saved Assistant request
when the draft lacked an authored environment. The host now pins that current
reference room through ordinary history/save before inference. It preserves edited
rooms, rejects comparison-room requests before dispatch, and invalidates proposals
when the preview environment changes. The context carries the full feature index
with exact identities, classification, pose, dimensions, support faces and
confidence, without photo bytes or protected-media identifiers.

Generic placement is excluded from the fixed-room provider schema. Surface creates
need a reviewed ROOM_PLACEMENT in the selected bundle. Geometry resolves proximity
against rotated feature footprints, projects toward the landmark, then seeks the
nearest fitting clear point. Doors/windows, authored reservations and existing
asset footprints remain blockers. This does not survey or certify a physical room.

## Bounded paid observations

[Original public synthetic rounds](evidence/assistant-room-placement-20261013.json)
retain 26 Luna calls, their failures/clarifications and settled usage: USD0.011679915.
Eleven scenarios cover the Bedroom entrance/window/desk/chair/floor/lamp, Dorm door,
Office entrance desk, Gallery doorway and Living Room sofa table. Early calls
asked unnecessary wording/side questions; one chose excessive width and was safely
rejected. Revised instructions draft thematic wording, resolve descriptive furniture
terms, preserve landmark IDs and choose compact readable defaults. A subsequent
edge-fit report exposed floating-point boundary sensitivity, corrected with a
one-micrometer bounds tolerance. No automatic retry or Astra escalation occurred.

Prior settled task usage was USD1.670195065; with these calls it is USD1.681874980.
Conservative combined exposure including earlier unknown reservations is
USD3.739874980, below the owner's USD5 ceiling. This task accounting is not a live
account-wide usage claim. Original dirty-source records remain observations; no
receipt is relabeled as exact-candidate qualification.

## Selection, order and clearance

An asset/room-feature click now selects one item regardless of group membership.
Explicit Groups-tab selection edits a complete group. Individual context menus
retain ordinary controls. The native hover title is only Group; Assets/Groups use
the Library tab style. Dragging previews row order and a cursor-following ghost;
drop commits one history step, Escape cancels, and Alt Up/Down reorders by keyboard.
Order changes do not move entities, change parents or alter group membership.

A selected asset group uses one rigid transform for surface-click placement. Every
member must fit the support; a lock or blocked member rejects the whole operation.
The floor is one overlay plane, with placement exclusions checked independently.
Actual contact parts remain separate rather than merging four legs into a solid
footprint. A conservative 18 cm modeled support-clearance band rejects low gaps
under the Bedroom bed while allowing clear floor below desks/chairs. This is an
authoring clearance policy for flat assets, not a universal real-world size test.
Automatic floor zones show the source's actual low parts; detached manual zones
remain authoritative reservations. Duplicated automatic collision geometry is
excluded from discovery because its source already supplies the same blockers.

## Presentation and remaining evidence

Assistant request entry, actual working indicator and proposal entry use existing
Lanternwake motion preferences/tokens. Blue orbit rings, a breathing center and
sequenced lights make work visible. No simulated percentage or delayed response is
introduced. Stale/rejected proposal actions disappear immediately; reduced motion
keeps the state text and static ornament. Browser capture and independent review
of this increment are pending. Owner presentation acceptance remains unclaimed.

The current selected suite passes 704 canonical/component/camera checks; full isolated typecheck, lint and documentation/catalog validation pass.
The expanded browser journeys additionally check individual grouped-member
controls, live ordering before persistence, keyboard order, atomic five-footprint
floor clicks and Undo. These are task-owned synthetic journeys, not device proof.

The follow-up correction adds a schema-validated relative world translation and
scale factor through the existing editing-selection transform. Two live desk/wall
move-and-shrink checks preserve world height, support, clue and rotation and use
first-person summaries. Absolute transform proposals are checked against current
room containment and bound clear support before preview/apply. This closes a known
validation gap; the owner's exact erroneous provider response was not captured.

The Assistant now has one frame with icon Dock/Float and Close controls, a whole
header drag area, edge resizing and a fixed ready-state label. The legacy Guided
placement dropdown is removed while normal manual tools remain. Earlier requests
and read-only responses stay in the current task conversation through
clarification. Cancel/new-task/close clears them with motion and interrupts an
outstanding request; viewing the canvas preserves the active review. Proposal
headings are concise, first-person wording is requested, and repetitive explanation
and caveats remain available under expandable details.

At frozen source 7dc37eed, six of eight bounded browser journeys passed.
The new row-order journey did not reorder before drop; the entrance journey
reached a control covered by floating assistance. Repairs acquire pointer
capture at row press, wait for editing readiness, and use the normal View canvas
action before reaching an obscured tool. This original failed run is retained;
its source is not relabeled. A fresh repaired-source capture is required.

At 60921997, seven of eight journeys passed. The live row preview moved, but
insertion thresholds were measured again from the already-reordered rows, causing
an unstable slot near the pointer. The next bounded repair retains press-time
row centers, adjusts them for scrolling, and previews against those stable slots.
Original failed receipts remain retained. This correction requires a new capture;
passing related journeys is not substituted for the failed order journey.

The 2b00b651 recording showed the cursor-following preview stop partway through
the gesture after React moved the captured row in the DOM. The final bounded
repair moves gesture listeners to the window for the press/drop lifetime, so
row reconciliation cannot interrupt delivery. Focused regressions check live
movement with events targeting another row, one drop commit, unrelated pointers,
Escape and unmount cleanup. A transient missing brace during this repair was
corrected immediately; the running Studio route returns HTTP 200 without a
parser/build error. Rendered and source-bound verification remains required.
