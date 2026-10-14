---
title: Spatial Studio user experience and AI development overview
audience: product-engineering
status: active-development-reference
canonical_for: parallax-spatial-studio-user-development-overview
last_reviewed: 2026-10-14
---

# Spatial Studio user experience and AI development overview

Parallax lets a Creator build an editable room, place meaningful spatial assets,
organize and animate them, and attach the resulting scene through Voyagewright's
existing Chronicle system. Photo reconstruction supplies an approximate room;
the Spatial Assistant proposes edits to the actual current scene. Both remain
subject to deterministic validation and Creator review.

This overview describes the active development candidate on 2026-10-14. It
collects the user-facing work, actual model decisions, measured request costs and
timings, built-in instructions, and the checks that make proposed geometry
usable. The larger overhaul is still in development: passing construction and
save/reload checks does not establish photographic fidelity or physical AR
accuracy. The [overhaul checkpoint](Spatial_Studio_Overhaul_20261012.md) tracks
integration and remaining acceptance separately.

## Workspace presentation and editing controls

Parallax is the page title at the upper left; the current scene has a separate
centered title and scene indicator. Library/Scene Graph on the left, contextual
Inspector on the right and timeline/simulation/diagnostics/events below provide
distinct working sections. Panels can be opened, resized or collapsed, and
floating assistance overlays the room instead of consuming scene width.

The refined interface keeps the established blue Studio identity with rounded
surfaces, quieter hierarchy and shared icon buttons. Light mode applies across
the workspace, not only individual popups. Tooltips name icon actions, while
right-click menus offer relevant asset, group, room-feature, scene and timeline
commands. Keyboard equivalents remain available instead of requiring a mouse.
Guided, Detailed and Engineering modes progressively expose more control without
creating different authoritative scene models.

The scene uses actual constructed geometry and entity transforms. Camera reset,
framing and perspective choices remain editor controls; a selected off-screen
object can be located or framed without silently changing its authored position.
Inspector text preserves spaces and newlines. Live timeline and graph gestures
preview interaction while committed edits use the normal history/persistence path.
Repeated ten-room diagnostics are not rerun for every workstation control change.
These corrections address specific working friction; they are not a measured
frame-rate guarantee across all room sizes, devices or content.

## Creating and keeping environments

Library has Assets and Environments tabs. The plus button in Environments opens
three choices:

1. **Existing environment:** choose a built-in or saved room, create an independent
   editable copy, and open it for editing.
2. **Empty environment:** begin with an editable shell and add room features.
3. **From photos:** select one or two views of the same room, authorize processing,
   reconstruct, inspect the proposed 3D room, and apply it if useful.

Edited and reconstructed environments are reusable through the environment
library. They can be named, selected, duplicated, edited or removed through its
existing controls. Selecting a room for preview and editing the scene's owned
environment are distinct operations; a built-in preview is not silently
rewritten as a shared preset. Changes use the ordinary draft/history/save path.

Built-in rooms have furnishing and architectural identities appropriate to their
names, rather than being the same arrangement at different sizes. Room-feature
editing uses the viewport pencil control, selection and the same Move, Rotate
and Scale tools used for assets. The Inspector supplies names, positions,
independent dimensions, upright yaw and feature-specific controls such as door
state or appliance shape. Room features are authoring geometry; their simplified
construction does not imply that every visible detail was photographed.

## The photo reconstruction journey

### Inputs and scale

The input accepts one or two JPEG, PNG or WebP images, at most 8 MiB each. A second
view gives additional evidence about occluded features, room depth and furniture
relationships. Both views are sent in one reconstruction request using one room
coordinate frame; they are not independently reconstructed and casually merged.

A real measurement is optional. The model estimates a plausible relative scale
from visible geometry and proportions. The review calls this an estimate, and
the Creator can later change relative scale or supply a known measurement.
Scaling a reconstructed room is separate from measuring its physical counterpart
or calibrating an AR tracking frame. Furniture width and depth are estimated
independently: square and rectangular tables are both supported, with no mandatory
table aspect ratio.

Lens-value entry, calibrated photo collection and distortion correction are
explicitly deferred. The current implementation does not claim to unwarp an
ultrawide photograph. Perspective, cropped edges and occlusion can still affect
orientation and dimension estimates.

### What processing does

The server checks account ownership and processing consent, stores imported
media through the protected-media provider, and uses a sanitized WebP derivative
bounded to 2048 pixels on each axis. The model receives the authorized derivative,
image dimensions, optional existing-room context, server instructions and a strict
observation schema. Source photographs are not embedded into authored scene
geometry or republished when the room is applied.

The response is structured evidence: estimated room dimensions and features,
positions, dimensions, yaw, attachment relationships, per-view orientation or
facing evidence, confidence, uncertainty and clarification. It is not executable
code or a finished mesh supplied by OpenAI. Parallax maps it into its own feature
identities and constructs the generic floor, walls, openings and furnishing parts.

The request uses the Responses API, `store: false`, no tools, default service
tier, low text verbosity and the configured room reasoning effort. The complete
multimodal body is counted before generation. Image bytes are not counted as
ordinary base64 text tokens. See the [privacy-reviewed request and response
examples](OpenAI_Request_Response_Examples.md) for the full request structure.

### Waiting, cancellation and recovery

The accepted animated thinking view remains intact. A compact **About 1–2 minutes**
indicator appears immediately with elapsed time, such as **0:20 elapsed**. It is
an expectation, not a promised completion deadline or fabricated percentage.
After two minutes the UI acknowledges that the request is taking longer and
keeps cancellation available. Reduced-motion presentation retains meaningful
state and timing text.

The current local test policy permits up to 180 seconds for a request. The shared
default policy still has a 20-second timeout; a new deployment needs an appropriate
administrator setting rather than assuming the local configuration is universal.
Longer reasoning, additional output, provider load or network delay can all extend
the wait. The UI does not silently replace a failed response with made-up geometry.

Failure and clarification have visible recovery states. The user can review the
specific issue, change views or input and explicitly try again. Cancellation
stops the active task and leaves the saved scene unchanged. It does not guarantee
that a dispatched provider call was free: when final usage is unknown, accounting
retains exposure instead of treating it as zero. There are no automatic paid
retries or silent upgrades to Astra.

### Reviewing and applying

A valid response opens a rendered room proposal. Review distinguishes uncertain
features, inferred hidden geometry and any bounded fitted adjustments. Apply is
an explicit Creator action; preview does not change the saved environment.
Apply checks the current scene identity, revision and editor generation, validates
the geometry again, and saves through the canonical draft transaction. Stale
proposals must be reviewed again instead of overwriting intervening edits.

The latest real two-photo Sol journey completed import, inference, 3D review,
Apply, save/reload, relative scale editing, Undo and withdrawal of both photo
processing permissions. It used no supplied room measurement. This establishes
that the workflow works for that bounded run; room orientation and seating
repeatability remain under review.

## Model choice and why it changed

| Operation                   | Current selection | Reasoning and policy                                                                                           |
| --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Standard Spatial Assistant  | GPT-6 Luna        | Low reasoning by default; inexpensive, frequent structured scene edits                                         |
| Room reconstruction         | GPT-6.1 Sol       | Separate room-model setting; room requests use the configured advanced reasoning effort, currently low locally |
| Optional advanced Assistant | GPT-6.1 Sol       | Separate eligibility and mode; not silently selected for a difficult standard message                          |
| Astra                       | Excluded          | Owner rejected its cost/benefit after the bounded comparison; no longer a selectable model                     |

Admiralty's AI Usage & Quotas Global Policy exposes the three model selections.
The existing People dossier contains per-person overrides; there is no second
general user search. User Overrides lists model, quota and access exceptions,
their matching audit reasons, expiry and whether they are active or inherited.
Review/reset opens the canonical privileged command flow. Reset removes current
exceptions while keeping usage history and audit records.

An override cannot bypass the allowed-model list, disabled access, suspension,
spending limits or concurrency admission. Expired model exceptions inherit
global settings. This permits model changes without rewriting browser code or
placing a credential in individual worktrees.

The daily chart can switch between requests, settled cost and accounted spending
(settled cost plus pending or unresolved exposure). It includes today's figures,
daily averages and an exact daily table. Buckets use the UTC day of admission;
averages include zero-activity days from the month's start. Released reservations
are excluded. Usage history exposes safe model/status and token/cost details,
without showing private prompts or credentials. These distinctions explain why
the quota's accounted amount can exceed the settled amount after cancellation.

### Sol versus Astra on the same one-photo and two-photo task

The retained comparison used the same supplied room views and source for each
model's one-/two-photo pair. These are individual observations, not a benchmark
over many rooms. Input/output tokens are provider-reported; elapsed time is the
comparison's recorded request timing.

| Model | Photos | Input tokens | Billed output tokens | Settled ledger USD | Recorded seconds | Geometric result                                 |
| ----- | -----: | -----------: | -------------------: | -----------------: | ---------------: | ------------------------------------------------ |
| Sol   |      1 |        5,811 |                3,930 |          0.0470844 |           63.080 | Proposal                                         |
| Sol   |      2 |        8,785 |                4,026 |          0.0554794 |           62.729 | Proposal                                         |
| Astra |      1 |        5,812 |                3,951 |          0.2378890 |           84.508 | Proposal                                         |
| Astra |      2 |        8,783 |                4,079 |          0.2814265 |           91.430 | Clarification: intersecting constructed features |

Astra cost approximately **5.05 times** Sol for one photo and **5.07 times** Sol
for two, with about **34%** and **46%** longer recorded waits respectively.
One-photo Astra cost approximately **4.29 times** two-photo Sol. It did not
resolve the disputed table orientation, and the two-photo Astra observation
contained a chair/panel solid intersection and was not admitted as a usable room.
The owner saw no sufficient visible improvement to justify this premium and
explicitly rejected Astra. This decision is specific to the observed task and
costs; it is not a claim that Astra is universally worse at vision.

### Why Luna remains the Assistant model but not the room model

Luna is much cheaper and was faster in the retained photo samples. It occasionally
produced an admitted room, so it would be inaccurate to say it never works.
However, repeated photo runs encountered out-of-room extents, incorrect support
relationships, ambiguous orientations and intersecting boards or furniture.
The implementation safely rejected these responses instead of passing them on
as completed reconstructions.

One earlier bounded pair illustrates the tradeoff:

| Model | Photos | Input tokens | Billed output tokens | Settled ledger USD | Provider seconds | Result                                           |
| ----- | -----: | -----------: | -------------------: | -----------------: | ---------------: | ------------------------------------------------ |
| Luna  |      1 |        5,554 |                2,112 |        0.001750175 |           19.284 | Proposal; photographic quality still approximate |
| Luna  |      2 |        8,530 |                2,310 |        0.001927695 |           19.387 | Room evidence rejected                           |

These Luna observations use earlier prompts/schema than the Sol/Astra comparison;
they are evidence of development outcomes, not a controlled accuracy ranking.
More recent local Luna canaries also rejected both one-photo and two-photo rooms
for wall attachment, support and layered-panel issues. Their settled costs were
$0.0017194 and $0.0024353. A cheaper response that needs correction is not a usable
replacement for an admitted room. Sol offered the better observed room
quality/cost balance, while Luna remained effective for smaller text-and-geometry
authoring tasks.

Increasing Sol from low to medium reasoning also did not justify a new default:
one-photo low cost $0.0501985 at 60.982 seconds versus medium $0.0699885 at
100.072 seconds; two-photo low cost $0.0557333 at 67.919 seconds versus medium
$0.0839308 at 119.012 seconds. The medium one-photo response had an equipment
overlap, and neither joint sample resolved the disputed table heading. Those
one-sample comparisons support retaining low reasoning, not a universal conclusion
about reasoning settings.

## Tokens, costs and completion time

### Current API prices and accounting

Standard short-context prices checked on 2026-10-14, per million tokens:

| Model | Ordinary input USD | Cache read USD | Cache write USD | Output USD |
| ----- | -----------------: | -------------: | --------------: | ---------: |
| Luna  |               0.10 |           0.01 |           0.125 |       0.50 |
| Sol   |               2.00 |           0.10 |            2.50 |      10.00 |

Sources: [official Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna)
and [official Sol model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
The application uses default processing, not premium Fast or Ultrafast service.

Input categories are exclusive: ordinary input equals total input minus cache
reads and cache writes. Charge each category at its own rate and add billed
output. Output usage includes reasoning tokens; do not add them a second time.
The structured schema, server instructions and room/scene context contribute
input tokens in addition to images or the typed message. Two photos need not
double the cost because instructions/schema are shared and output is one room.

Parallax stores integer USD nanodollars, with one dollar equal to one billion
units. A reservation is the admitted maximum exposure, not the final charge.
Settled results use provider usage and the request's pinned pricing revision.
Historical conservative revisions are preserved rather than recomputed to look
cheaper. Ledger amounts are application accounting, not an OpenAI invoice.

### Measured room requests

The comparison above gives exact one-photo/two-photo tokens and costs. Its two
Sol samples average **7,298 input tokens**, **3,978 billed output tokens**,
**$0.0512819** and **62.905 recorded seconds**. That average combines one photo
and two photos and has only two samples; it is not a per-photo forecast.

The newest low-verbosity two-photo Sol run reported **9,906 input tokens**,
**3,913 output tokens**, **$0.0638935** settled cost and **69.964 seconds**
from preparation through deterministic validation. Its stages were:

| Stage                      | Seconds |
| -------------------------- | ------: |
| Context preparation        |   0.024 |
| Admission                  |   0.020 |
| Exact input-token counting |   1.907 |
| Provider generation        |  67.898 |
| Validation                 |   0.089 |

The stage sum differs slightly from total due to other orchestration work.
This shows that provider generation dominated that wait. The orbit animation
does not introduce the delay. Low verbosity and shorter evidence reduce
unnecessary output, but one run does not establish a guaranteed speed improvement.
The browser's 1–2-minute guidance is more useful than a precise countdown for
these observed roughly 60–80-second low-reasoning requests.

### Measured Assistant requests

A retained set of **26 synthetic room-grounded Luna requests** spans eleven
placement scenarios and multiple instruction revisions. It includes clarification
and rejected proposals, not only successful results. Its aggregate figures are:

| Metric                                | Recorded result |
| ------------------------------------- | --------------: |
| Mean input tokens per request         |        3,994.54 |
| Mean billed output tokens per request |          438.69 |
| Mean provider time                    |   5.578 seconds |
| Total settled ledger cost             |    $0.011679915 |
| Mean settled ledger cost              |   $0.0004492275 |

Earlier compact text-edit experiments were smaller: a ninety-request historical
Luna round averaged about 2,133 input tokens, 206 output tokens, 2.740 seconds
provider time and $0.0001862861 per request. Its 83/90 strict checks passed;
that is a corpus result, not a promise of 92% success for arbitrary requests.
The larger current room index, conversation and capabilities can increase input.
Do not reuse the compact-study average as a guarantee for furnished scenes.

### A two-photo room followed by twenty Assistant messages

Using the latest measured room cost plus twenty times the historical
room-grounded Assistant mean gives an illustrative total of
**$0.0638935 + 20 × $0.0004492275 = $0.07287805**.
This combines two datasets, not a measured complete twenty-message customer
journey. For planning, assume each Luna edit has 3,000–6,000 input tokens and
300–900 billed output tokens and charge input at the cache-write rate without
depending on cache hits. Twenty edits then cost approximately **$0.0105–$0.024**,
giving **$0.0744–$0.0879** with the latest room request before extra attempts.
About $0.10 is a planning allowance for this workflow, not a guaranteed cap.

Messages asking for clarification, invalid geometry, cancellation after dispatch
and additional reconstruction attempts can consume budget too. Manual editing,
surface discovery, groups, exclusion edits, timeline playback, preview, save,
Undo and redo do not themselves make an OpenAI generation call. API cost excludes
application hosting, storage, networking and other services.

The [numeric evidence](evidence/spatial-studio-user-development-metrics-20261014.json)
contains only sanitized aggregate/request metrics. The [task spending snapshot](evidence/openai-model-routing-latency-spend-20261014.json)
separately retains unsettled exposure under the owner's $5 development ceiling;
it is not a typical-user cost estimate or account-wide live billing total.

## Instructions, context and what training means here

There is **no custom model training or fine-tuning in this implementation**.
Development has tuned server-owned instructions, structured response schemas,
scene context, deterministic mapping and validators using synthetic tests and
bounded authorized photo experiments. Those changes do not update OpenAI model
weights or establish learned behavior for every possible room.

The earlier synthetic instruction-selection study recorded **15 rounds and 484
calls**, totaling **$0.263774605** under its historical accounting revision. It
tested instruction variants and bounded model responses; this was evaluation
spending, not fine-tuning or a charge a Creator incurs when opening the Studio.
The [retained study](evidence/owner-refinements/model-comparison/study.json)
preserves each round's source, instruction digest, strict checks and model metrics.
Later room-aware instructions and photo evidence contracts changed separately;
the old study cannot certify the expanded current capabilities.

The [exact built-in instruction snapshots](reference/Built_In_Instruction_Snapshots_20261014.md)
contain the current room-reconstruction, general Assistant and room-aware
Assistant strings, with hashes and source links. They contain no Creator input,
private photographs, secret or raw private response. They are engineering
reference snapshots; editing them does not change live prompts.

Room instructions require generic furniture names, no transcription of private
documents, a consistent coordinate frame, independent dimensions, evidence-based
attachments and uncertainty. They explicitly address open doors, ceiling
projectors, supported stacks, tucked chairs, table edge families, chair-side
evidence and cabinet fronts. One photo may be ambiguous; two views must be
reconciled around the same feature instead of accumulating duplicates.

Assistant instructions require first-person future action summaries, such as
“I'll move the note,” preserve unrequested content and transforms, resolve prior
task intent before incidental UI selection, and use current-room feature IDs
for requested surfaces and landmarks. Scene labels, visible image text and user
messages remain untrusted data and cannot expand its authority.

The model receives a bounded projection of the current scene: entities and
identities, selection, retained task/follow-up focus, groups, supported behaviors,
animation tracks, placement policy and available room geometry. Room features
include classification, names, centers, dimensions, yaw, support faces and
uncertainty. Ordinary furniture terms are resolved by meaning and relationships,
not merely exact labels. Later edits do not resend the original room photographs.

Responses use strict Structured Outputs and a bounded operation list. The model
does not execute arbitrary JavaScript, browse arbitrary URLs, change Admiralty
quotas, alter other accounts, publish a Chronicle or advance progression. OpenAI
API data is not used for model training by default unless the customer opts in;
provider retention controls are separate from Parallax's local retention and
`store: false`. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## How proposed rooms are verified

Validation asks whether the returned observations can become a coherent, editable
authoring room. It cannot establish that the model saw the physical room correctly.
Confidence is recorded separately from geometric validity; a high model confidence
never suppresses a collision finding.

### Admission and structured evidence

Before generation, the server checks ownership, photo purpose/consent, provider
readiness, model policy, token limits, budget, rate and concurrency. After generation,
strict schemas check finite bounded values, feature limits, valid classifications,
unique observation keys and references to distinct existing features. Invalid
relationships, cycles or malformed output fail instead of becoming executable edits.

Width, height and depth are named on the wire to prevent axis confusion. Mapping
converts them into Parallax's canonical dimension ordering. Table edge evidence,
cabinet-facing evidence and chair-side evidence are checked against pose and the
supplied view indices. Conflicting confident relationships are rejected; insufficient
or ambiguous evidence lowers confidence or prompts review.

### Geometry construction and meaning

Parallax builds floor, wall and ceiling parts plus real openings from the observation.
Furniture uses class-appropriate generic solids. A projector has an appliance
representation and mounting pole; it is not automatically rendered with cabinet
doors. An open door is recognized from frame/passage/hinge evidence and produces
an aperture instead of requiring a closed panel. Declared board/screen layering
keeps separate front/back parts rather than treating all visible rectangles as
one overlapping solid plane.

Attachments must make sense. Floor furniture needs ground contact; ceiling
equipment reaches its declared support; wall displays belong on the declared
wall; equipment on furniture needs an actual modeled supporting feature.
Relationships cannot be invented merely to excuse an overlap.

There are limited disclosed adjustments for approximate first reconstructions:
declared floor-standing furniture can close an initial height gap of at most
0.15 m, and an estimated chair with an observed table relationship can try small
outward shifts, capped at the smaller of 0.15 m and 20% of its footprint dimension.
Every candidate is rechecked, confidence is reduced and a fitted-placement warning
is prioritized for review. This does not permit arbitrary relocation, rotate a
table to fit the supplied room, overwrite Creator-confirmed corrections or
invent missing observations.

### Independent checks of constructed parts

The construction verifier inspects the full realized geometry, including parts
hidden by display-only cutaways. It checks:

- Complete feature/part identities and finite bounded transforms.
- One continuous floor support, shell topology, actual wall openings and room bounds.
- Upright/yaw geometry supported by the current checker; unsupported tilt is flagged.
- Actual ground/furniture support and valid attachment relationships.
- Interpenetrating solids from different features, respecting each part's rotation.
- Support-surface construction, declared clear paths and broad furnishing plausibility warnings.

Solid overlap uses vertical intervals and a separating-axis test on yaw-rotated
horizontal rectangles. The current construction tolerance is 0.015 m. Touching
supports are allowed; true overlap beyond tolerance is an error. This tests
constructed solids rather than declaring every pair of overlapping furniture
bounding boxes invalid. A chair can tuck beneath a tabletop if its seat/legs fit
between table parts and its back does not penetrate the top. Observed equipment
can stack on a real supporting surface. Exclusion boxes are reservations, not
physical furniture, and are excluded from physical interpenetration checks.

Errors return a correction/clarification result that identifies affected features.
Warnings remain visible for review. A proposed room is only admitted when blocking
construction errors are absent. Apply repeats checks and enforces scene revision
and photo authorization, then uses the canonical save transaction. No fabricated
replacement room is returned after an upstream or validation failure.

### What verification does not prove

A valid 3D room can still place a cabinet on the wrong wall, omit an occluded chair
or choose an uncertain table heading. Numerical validation can reject impossible
geometry, but cannot certify photographic interpretation, exact dimensions,
complete furnishings or physical AR alignment. The latest independent private
review confirmed proposal/save equality and rendered transform propagation;
cabinet facing improved, while table orientation, chair sides/count and omitted
details remain approximate. Raw room observations and owner photographs remain
outside public documentation and Git.

One-photo and two-photo results are not yet proved consistently close across
arbitrary rooms. Review and manual corrections remain meaningful parts of the
experience. Real-device evidence is needed before claiming objects stay anchored
while an iPhone user walks around.

## Surfaces, clearance and placement

Surfaces are discovered from the current constructed room geometry. They are not
a fixed list of preset-only points. The floor is one continuous logical support
plane; each suitable wall face and furnishing top provides its own support.
The Surfaces overlay helps inspect those planes. A cutaway or clipped wall in the
camera view does not delete the corresponding room geometry.

Doors/windows cut out wall support. Furniture contact parts, occupied asset
footprints and exclusion zones are checked separately from the continuous floor
identity. The overlay can show one floor without allowing placement through
every object sitting on it.

Floor below a table or chair can be usable when there is suitable modeled
clearance. Separate leg/contact parts avoid turning four legs into one solid
floor-sized rectangle. A conservative 0.18 m clearance band protects low gaps
in the current flat-asset placement policy; this rejects the low modeled space
under the Bedroom bed. It is not a universal physical fit guarantee for every
future asset shape. Suitable clearance and the requested asset footprint matter.

For automatic placement, room-aware intent names the desired support and any
nearby landmark. The deterministic resolver searches the nearest clear fitting
area, including existing/new object footprints and reservations. “A readable
note on a wall near the entrance” targets an existing door and nearby clear wall,
not the middle of a window or an arbitrary wall center. Missing or multiple
plausible landmarks require clarification rather than invented furniture.

Manual placement uses explicit selection and click/drag tools. Clicking a valid
surface moves the selected asset to the clicked location and aligns its orientation
with that support. A group explicitly selected in Groups moves as a whole using
one shared transform; a blocked or locked member rejects the whole placement.
Selecting one grouped asset keeps its ordinary individual controls. Manual and
automatic modes expose different authority over authored positions; an adaptive
recipe is not silently overridden by a manual transform.

## Exclusion zones

An exclusion zone is a clear outlined volume that reserves modeled space against
automatic best-fit placement. It is useful around clutter on a desk, equipment,
a reserved passage or another region that should not receive an asset.

There are two sources:

- **Automatic zones:** generated from modeled blockers on specific support faces.
  They follow the source feature when it changes. Floor envelopes retain actual
  low contact parts so they do not unnecessarily reserve every space under legs.
- **Manual zones:** explicitly authored independent volumes. They can apply to a
  chosen support or intersecting surfaces and retain the Creator's chosen bounds.

Library → Assets now includes an **Exclusion Zone** card under Tools. Clicking
or dragging it into the current scene creates a manual environment zone, opens
environment editing and selects its clear box. This reuses the environment's
canonical exclusion representation, rather than creating a second runtime
object that merely looks like a reservation. The existing Room features controls
also retain Add exclusion zone and Find surface blockers.

Zones use the same viewport Select, Move, Rotate and Scale tools as assets and
other room features, and can be named, resized per axis, grouped and removed.
They belong to the environment, so editing them requires environment edit mode.
Finishing that mode hides the clear boxes from the ordinary scene presentation;
their placement constraints remain active. They are not a player-visible clue
or support surface.

Editing an automatic zone detaches it from regeneration and records suppression
of the original generated pair, so a later refresh does not undo the edit. Removing
a physical source removes its generated envelopes; a manual zone survives source
changes. Deleting a zone does not make the underlying furniture disappear or
permit placement inside its actual solid parts. The Assistant may not remove
reservations simply to bypass a failed placement.

## Spatial Assistant capabilities and conversation

The Assistant is part of the Studio, with a blue frame, smooth request/thinking/
proposal transitions and reduced-motion equivalents. Floating assistance can be
dragged from its header and resized; docking overlays the scene rather than
shrinking the working canvas. The composer stays near the bottom and empties
after Send. The submitted message stays in the task conversation.

Follow-ups retain earlier requests and read-only replies. General inference
resolves pronouns, corrections and the intended property from the current task,
previous operations and scene metadata, rather than recognizing one special
phrase or trusting whichever object happens to be highlighted. A uniquely resolved
prior subject takes priority unless the new request names another subject or
explicitly asks for selection. Multiple plausible subjects remain a clarification.
Cancel, close and Start new task clear that task history with motion.

Supported proposals include:

| Area                    | Implemented scope                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assets                  | Create supported parchment/text/marker objects; rename; change clue/alternative text; move, rotate, resize; duplicate, remove, reorder and manage supported parent/layer settings |
| Current room placement  | Search existing feature classifications, names and relationships; request placement on supports near landmarks; validate clear fit and preserve orientation/support               |
| Groups                  | Create, name, rename, change members, ungroup and move/rotate/scale whole groups; room members require environment editing                                                        |
| Room editing            | Add generic features, transform and remove permitted existing features while environment editing is active; preserve floor and attached-support safeguards                        |
| Scene metadata          | Change supported title, tags, collection and favorite fields without changing identity, ownership or publication                                                                  |
| Animation               | Add/edit supported entity-bound tracks, timing, keyframes, enabled state and interpolation; remove tracks without deleting the asset                                              |
| Interactions and access | Supported Pick/Inspect/Place and timer/scene-enter behaviors; Guided narrative, meaningful alternatives and critique                                                              |

This is bounded authoring, not “every conceivable Studio operation.” Unsupported
media, materials/particles, physical recognition, arbitrary scripts, publishing,
quota administration and progression changes remain outside its operation schema.
Requests unrelated to Studio work receive a fixed scope redirect. Fictional clue
or riddle writing for the scene remains in scope. Intent classification is
model-assisted; it is not perfect recognition of all natural language.

Every edit is a reviewed proposal. The server checks operation IDs, references,
dependencies, locks, allowed capabilities, current-scene digest and constraints.
Relative movement uses world deltas without copying a world height into an
anchor-local position; this preserves unrequested height, rotation, text and
support. The proposed draft is checked before preview and Apply. The Creator
chooses Apply or Reject, and the usual Undo/redo history remains available.

## Groups, Scene Graph and timeline editing

Scene Graph has Assets and Groups tabs matching Library's tab treatment. Its top
toolbar centralizes selection commands such as visibility, lock, removal and
group creation. Multi-selection works with modifiers/ranges, keyboard controls
and contextual menus. Explicit group selection highlights and transforms all
members while clicking a member selects that member only. Groups have editable
names and membership without changing parent hierarchy or creating a separate
runtime engine.

Clicking an asset or group name opens inline rename on the first click; F2 remains
available, Enter commits and Escape cancels. The corrected drag handler delays
pointer capture until a real drag starts, so it does not steal name clicks.
Dragging rows shows live ordering and a pointer-following preview. Drop commits
one history edit, Escape cancels and Alt+arrow keys reorder without moving the
actual objects in the room.

Scene Timeline binds animation tracks to actual scene entities. Clips have
selection, editing, contextual actions and live movement/resizing. A connected
playhead grabber and vertical current-time line scrub the scene. STEP intentionally
jumps between states; SMOOTH interpolates poses; CINEMATIC adds lightweight seeded
variation and asset-sensitive flourish while preserving endpoints. Playback
previews authored animation, and scrubbing previews the pose at the chosen time.
Fixed/adaptive placement restrictions still apply; adaptive positions are not
arbitrarily keyframed around their placement solver.

## Privacy, local configuration and readiness

The shared Windows user-level `OPENAI_API_KEY` is read only on the server through
`process.env.OPENAI_API_KEY`. Independent worktrees do not need it copied into
their `.env.local`. Diagnostics report configured/unconfigured status without
revealing the value. The Codex Cloud vault is a different environment and does
not provide credentials to local Windows processes automatically.

Photo processing consent can be withdrawn and expires after its configured
authorization period. Photo storage retention, withdrawal, OpenAI request storage
and provider data-retention policy are different controls. The local development
photo scanner is explicitly uncertified; it does not establish production private
media screening readiness. Documentation and committed examples exclude real
photographs, private observations, authentication state and credentials.

Browser-first Chronicle Lens remains a product objective. Guided fallback is
explicit; it is not a claim of genuine world tracking. The proprietary 8th Wall
SLAM binary is held for licensing clarification. TinyVIO remains an explicitly
enabled local prototype; release requires rebuildable permissive source and
qualified runtime behavior. Normal Chronicle progression, pairing and authored
scene data retain their canonical owners. Actual Safari alignment, walking
stability and device acceptance remain open.

## Source and verification references

The latest exclusion-library/name-click increment is source
`2f7727ac8a4742fb62e2e9ba4b1912d703e0ca7e`, tree
`5f12eea05dbb45b20570035390975838dd04b9b3`. Twenty focused component checks and
eight unpaid authenticated development-browser journeys passed, including repeated
single-click rename, Library zone creation/save/reload, live reorder and whole-group
floor movement. This is bounded implementation/journey proof; independent visual
review and owner acceptance are separate.

- [Creator guide](Spatial_Studio_Guide.md): ordinary Studio use.
- [Model routing, overrides and latency](AI_Model_Routing_and_Overrides_20261014.md): current policy and measured latest photo stages.
- [Orientation audit](Room_Reconstruction_Orientation_Audit_20261013.md): preserved failed runs, low/medium studies and unresolved fidelity.
- [Photo popup review](Photo_Popup_Review_20261014.md): setup, thinking, failure/retry and consent presentation.
- [Assistant and Scene Graph review](Assistant_Placement_Graph_Review_20261013.md): paid placement corpus, conversation, scope and editing safeguards.
- [Exact instruction snapshot](reference/Built_In_Instruction_Snapshots_20261014.md): current built-in instructions, no private inputs.
- [Sanitized numeric metrics](evidence/spatial-studio-user-development-metrics-20261014.json): token, cost and timing derivations.
- [Room reconstruction mapper](../../../src/parallax/room-reconstruction.ts), [construction verifier](../../../src/parallax/construction-verification.ts), [surface geometry](../../../src/parallax/room-geometry.ts), [exclusion rules](../../../src/parallax/exclusion-zones.ts), and [Assistant contract](../../../src/parallax/spatial-assistant.ts): live implementation authorities.

## Working drafts and Library continuation

The active PR #722 candidate autosaves a stable working definition without adding saved cards. Save to Library deliberately establishes membership on that identity. Save as new asks for a name, type and destination and creates an independent definition. Working Drafts and Legacy review remain recoverable views. Collections, favorites, typed search and archive/restore organize existing identities. Version history previews immutable snapshots and restores only mutable working content.

Environments are now independent definitions. Creating/editing/reconstructing one does not manufacture a Scene. Using a room in a Scene records an independent snapshot; editing the original does not update other Scenes or Chronicles. The Inspector distinguishes original definitions and placed instances. Conflicting saves retain pending work and require review or an explicit named copy. See [lifecycle details and verification boundaries](Spatial_Library_Lifecycle_20261014.md).

The original instruction/model measurements above remain historical. The [room instruction continuation](reference/Room_Instruction_Continuation_20261014.md) adds explicit rotated-frame seating offsets and returned-support requirements. A prompt adjustment alone does not prove improved reconstruction fidelity.
