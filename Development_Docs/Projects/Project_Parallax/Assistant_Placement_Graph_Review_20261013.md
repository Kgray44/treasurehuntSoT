---
title: Assistant placement and Scene Graph correction review
audience: product-engineering
status: in-progress
canonical_for: parallax-assistant-placement-graph-review-20261013
last_reviewed: 2026-10-14
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

At e5649b1c the live pointer order assertions passed. A later test assertion
incorrectly inspected the first library record rather than its owned fixture:
normal entry had also saved an initial workshop scene. The fixture lookup now
binds the exact definition identity. This changes no production ordering rule.

The owner's subsequent request clears the composer on Send while retaining the
submitted message in chat. Proposed-action instructions use affirmative future
tense, such as I'll place, while preserving explicit review before Apply.
An additional provider-only OUT_OF_SCOPE classification limits assistance to
Spatial Studio work. The server replaces every classified off-topic answer and
operation with a fixed Studio redirect; it preserves token accounting and never
applies an unrelated edit. Classification remains model-assisted, not a claim
that arbitrary natural-language intent can be recognized perfectly. Synthetic
tests cover unrelated arithmetic, personal advice, general knowledge, scope
injection and explicit fictional clue writing, which remains in scope.

The six bounded live Luna scope checks passed; original observations are retained
in [scope evidence](evidence/assistant-scope-20261013.json). They settled
USD0.001261985. Combined settled accounting is USD1.683136965 and conservative
exposure including earlier unknown reservations is USD3.741136965, below USD5.
The Bedroom action uses I'll; the clue-edit summary remained impersonal. Stronger
provider summary constraints still need testing. No provider retry or escalation
occurred, and the original dirty-source observation flag is preserved.

Frozen 42fb7a34 passed all eight selected browser journeys with VALID source
binding. The [archived review packet](../../Testing/Product_Experience/evidence/parallax-assistant-graph-20261013/42fb7a34f8f4/review-packet.json)
contains actual authenticated screenshots and complete recordings. Independent
review passes with limitations and no blockers; later owner requests are outside that frozen increment.

The next correction preserves transient spaces/newlines in Inspector name, clue,
accessible description and Guided narrative fields while meaningful values still
use canonical edit commands. Blank intermediate input is allowed locally, never
saved as an invalid blank. Room-feature membership and mixed-group transforms
require explicit environment edit mode; choosing a mixed group does not activate
that mode. The edit toggle is a pencil icon among the viewer's upper-right
controls with an accessible name, native hover title and pressed state. New
component regressions pass. Frozen 6a3b2eda passes nine selected browser journeys with VALID source binding, including actual whitespace entry/save/reload and explicit room group mode checks.


## Advanced commands and general conversational inference

The next candidate reuses canonical editor commands for asset removal, duplication,
parenting, order, layers, surface-normal rotation, scene metadata, interactions and
animation creation/style/timing/removal. Room feature creation, removal and uniform
transforms require explicit environment editing. Last-asset, bound-support,
whole-floor, lock, hierarchy, geometry and dependency checks remain authoritative.
This is an allowlist, not arbitrary scripts or direct database editing. Manual
history, account ownership, revision comparison and reviewed Apply stay in place.

Retained owner/draft-bound conversation supplies a reference-only subject derived
from current asset, group and room-feature identities. General pronouns,
elliptical continuations and corrections use that subject rather than incidental
UI selection. Explicit new subjects override it; multiple or removed subjects need
clarification. No phrase matching, old-transform replay or private clue disclosure
is introduced. Environment mode is included in request context and retained
proposal metadata; mode changes invalidate the local pending proposal.

[Live inference and advanced-command comparisons](evidence/assistant-follow-up-advanced-20261013.json)
retain all failures and costs. Investigation found the runner's CURRENT label was
an older frozen prompt; PRODUCTION now uses the actual provider prompt, preserving
historical variant identities. The summary-pattern experiment returned incomplete
zero-token responses and was removed. Actual production instructions passed all
four inference cases, then six cases after concise prompt refinement, including
asset removal and scene title changes. Three differently worded follow-ups edit
the prior subject even while another asset is selected; two prior subjects require
clarification. This does not prove every conversational phrasing.

These comparisons report USD0.006219430 additional settled usage; task settled total USD1.689356395, conservative exposure USD3.747356395, below the USD5 ceiling. No automatic retry or Astra escalation occurred.


The expanded local regression run passes 738 checks in 66 suites with one worker
and bounded 20-second test/30-second hook deadlines after an earlier loaded-host
run timed out. Assertions are unchanged; timings are not a performance acceptance
claim. Subsequent focused semantic-context checks pass 39 tests. Conversation
subjects now distinguish scene metadata, animation timing and interactions from
their target assets; field names are retained without private field values. Two
additional actual Luna checks pass for scene-title and animation-duration
follow-ups. Changing preview environments exits room edit mode, keeping the pencil
state and room-member permissions consistent.

Frozen candidate `35a8d779588e2721681b7231cf9568f0e2ca6350` passes all ten selected
actual authenticated browser journeys with VALID source binding. The
[current gallery and packet](../../Testing/Product_Experience/evidence/parallax-assistant-graph-20261014/35a8d779588e/review.html)
retain 59 screenshots and 13 complete recordings; no private photos, auth state
or traces are included. A fresh independent review observes all 17 dimensions
and records `VERIFY_FINAL_EVIDENCE`, bounded local acceptance with limitations,
and zero concrete blockers. Portrait graph density, a clipped inner-scroll
headline and transient fade/sticky-header captures remain nonblocking findings.
The new operation and mode journeys are verified in the captured desktop scope;
their complete phone/theme/reduced-motion cross-product is not claimed.
Owner review is requested and remains pending. This does not establish protected
integration, reconstruction fidelity or physical/device acceptance.
