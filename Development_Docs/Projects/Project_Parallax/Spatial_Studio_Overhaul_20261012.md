---
title: Spatial Studio functional and experience overhaul
audience: product-engineering
status: implementation-in-progress
canonical_for: parallax-studio-overhaul-20261012
last_reviewed: 2026-10-13
---

# Objective and focused source audit

Preserve the owner's accepted spatial workstation while completing its real
authoring workflow: reconstruct an editable room, resolve semantic placement,
find the placed object, animate and simulate it, then save and reuse the scene.
The scope and acceptance A–P are bound in the [owned task contract](../../../.agents/parallax-studio-overhaul.md).
This record distinguishes source findings from later rendered proof.

The supplemental [construction and verification standard](Spatial_Studio_Construction_20261012.md)
strengthens environment acceptance. Earlier distinct-preset visual review
does not qualify complete architecture, physical support, terrain/navigation,
independent geometric validity or production visual quality.

Baseline is protected `602f83ef`; owned reconciliation `211fe9ed` contains the
previous room/surface correction and preserves current protected contracts.
The running owner preview and all sibling worktrees are preserved.

| Area             | Verified source cause or existing authority                                                                                                                                                 | Required correction / proof                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI visibility    | Canvas consumes proposal entities, but READY only proves initialization; renderer supplies no per-entity visibility acknowledgment. Fixed selected-object framing uses a constant distance. | Bind instantiated geometry, bounds, clipping/occlusion diagnostics and recovery to the actual rendered entity; prove A/E.                          |
| Reconstruction   | Rooms currently come from synthetic preset geometry; no editable environment or photo import/analyze/refine workflow exists.                                                                | Extend normal scene data and governed protected image/perception seams; prove H and final demonstration.                                           |
| Timeline         | Behavior schema only supports SHOW/HIDE/HIGHLIGHT; track UI edits delays. No transform/material keyframes exist. Playback increments a 100 ms interval independent of elapsed time.         | Extend canonical declarative spatial behavior, one scene clock and actual renderer properties; prove F/O.                                          |
| Simulation       | Existing pure behavior evaluator responds to SCENE_ENTER/TIMER/INSPECT/PICK/PLACE; controls append inputs. With no matching authored event nothing changes; activity reports inputs only.   | Add observable evaluated conditions, targeted scene mutations and renderer acknowledgment; retain isolated state and Drydock ownership; prove G/O. |
| Saved library    | Owned CAS/versioned persistence exists. Saved UI mixes drafts/categories, and reusable asset-versus-instance flows and thumbnails are absent.                                               | Build real definition/instance/scene workflows on existing persistence; prove I.                                                                   |
| Navigation       | Left icon rail and adjacent Library/Hierarchy/Saved tabs switch the same leftTab.                                                                                                           | Retain the rail, contextual heading and keyboard semantics without redundant section tabs.                                                         |
| Input            | OrbitControls uses default middle dolly while Ctrl+left invokes pan; canvas pointer-up selection does not guard modifier-camera gestures.                                                   | Bind both to the same pan implementation, robust cancellation and no accidental editing; prove J.                                                  |
| Assets           | Props are planes, torus/cone compass and flattened spheres; most furnishings are boxes. Existing asset schema rejects unqualified imported media.                                           | Authored believable reusable geometry/materials with budgets/provenance; distinguish browser and native support; prove N.                          |
| Selection        | One BoxHelper identifies selected bounds, but no hover distinction, visibility reason or reveal/isolate recovery exists.                                                                    | Stable exact-entity feedback and synchronized inspection/framing; prove E.                                                                         |
| Fallback         | Adaptive resolution may switch directly to Guided; WebGL failure reports generic UNAVAILABLE and has no retry effect dependency.                                                            | Explain policy/capability/runtime reasons, preserve draft and retry the viewport; prove K/P.                                                       |
| Clamping         | Shared geometry/normal fitting now exists and rejects occupied supports. Snap is combined with grid stepping; explicit automatic-surface setting and drag acceptance remain needed.         | Maintain one geometry query path, independent intuitive toggle and rendered drag proof D.                                                          |
| Semantics        | Candidate surface/context enums exist; windows/furniture geometry lacks canonical object classification/confidence/relationships editable by Creator.                                       | Canonical authored feature registry and relation resolution with ambiguity/missing-target behavior; prove B/C/L.                                   |
| Assistant motion | Existing state/policy-driven motion is available, but renderer acknowledgment and spatial planning feedback are not execution states.                                                       | Extend truthful phases and scene-linked feedback through Lanternwake; prove M/P.                                                                   |

The audit does not establish runtime acceptance. Existing pure behavior and
library engines are retained; no replacement progression/simulation authority
is introduced. No new capability is complete until its state and actual
rendered journey have been verified. Physical AR and owner acceptance remain
separate. The photo workflow is now explicitly in scope, superseding the
earlier existing-room-only correction boundary for this new overhaul.

## Foundation implementation checkpoint

The owned candidate now adds optional bounded entity animation tracks (position,
normalized quaternion rotation, uniform scale and visibility). Old documents
retain their exact optional-field shape. One pure scene evaluator feeds Studio
preview and Lens transforms, preserves parent/anchor composition and resolves
visibility events chronologically with keyframes. Authoring exposes explicit
keyframe recording, numeric values, timing, interpolation, enabled tracks,
deletion, draggable markers, zoom, scrub, pause, restart and stop. History,
duplication, deletion and normal CAS persistence retain tracks.

The viewport emits actual post-render instance transforms/bounds and coarse
frustum, size and raycast visibility diagnostics. These are renderer-side
geometric diagnostics, not proof of pixel-perfect GPU occlusion. Framing uses
selected bounds; isolation removes the room for recovery; reveal returns to
editing. Middle-drag uses the same OrbitControls PAN operation as Ctrl-drag,
with transform/selection guards. Surface clamping and grid snapping are
separate controls. Explicit WebGL retry creates a fresh renderer and retains
the draft. The sole primary left navigation is the existing icon rail.

This foundation is implementation in progress. Photo reconstruction, asset quality, material/light/effect
animation, comprehensive simulation diagnostics, Assistant render-confirmed
execution phases and A–P acceptance remain open. Do not treat this checkpoint
as full overhaul or native/physical qualification.

## Editable semantic rooms and reusable definitions

The candidate stores optional editable room features in the ordinary scene:
classification, name, position, dimensions, yaw, provenance/confidence and
normalized primitive geometry. All ten presets preserve their distinct geometry
when converted to editable rooms. Rendering and whole-face discovery consume
the same primitives. Room edits retain surface identities; bound clues resolve
their current support frame. Shell resizing moves feature positions
proportionally while furniture keeps its explicit dimensions.

The bounded production-browser room journey and independent review at
`35823d95704cbd15d7760b2dc119e51d371c6093` verify name/classification edits,
desk translation/rotation, bound-clue correspondence, dimension-error recovery,
desktop save/reload and a saved phone edit. Camera persistence, photo analysis
and complete natural-language targeting remain unverified. Domain room-target
resolution distinguishes missing/ambiguous features and uses the shared surface
engine; the OpenAI adapter supplies a bounded semantic feature projection and
strict ROOM_PLACEMENT operations for fixed authored rooms.

Reusable object/assembly definitions now use the existing owner-scoped library
records and immutable spatial versions. Export copies only the selected subtree,
remaps identities and retains internal behavior/keyframes in a local frame. It
rejects external behavior and protected-media/perception dependencies. Insertion
copies a pinned owned release, retains origin metadata and installs through
ordinary editor history/autosave after a generation check. Instances are
independent; later definition edits and archive do not mutate their stored data.
The Saved panel distinguishes complete scenes, objects, assemblies, templates,
reconstructed rooms and scenes with imported models; thumbnails are explicitly
schematic, derived from entity poses. Scene copies preserve full authored data.
Imported model rendering and photo reconstruction remain unavailable. Manual
placement is required for reusable object/assembly export and insertion.

417 focused Parallax tests, changed ESLint and typecheck support the preceding checkpoint.
The production-browser library and simulation journeys pass at `c5f7f690`;
independent rendered review accepts the bounded desktop repairs. The
[bounded review record](Spatial_Studio_Room_Library_Simulation_Review_20261012.md)
retains room acceptance, library return-camera repair, failed test captures and
exact run evidence. No full library or overhaul acceptance is claimed here.

## Simulation experience design

The existing Simulation dock will show the current scene clock, selected source
object, available interactions, matching authored behaviors and their delays.
Running, pausing, seeking and resetting use the same clock and pure evaluator as
the timeline and Lens. Inputs remain a bounded transient session; switching
scenes stops playback and clears the previous scene's inputs. Reset returns to
the initial scene-enter/timer inputs and renders their initial state.

Each input will distinguish no matching behavior from a waiting delay, an
evaluated action and an audience-excluded action. The resulting object state
will be shown beside actual renderer visibility diagnostics. Creator-facing
feedback explains recovery when an interaction has no authored effect or a
result is outside the viewport. Engineering mode adds source identities and
transforms; Guided mode retains object names and explicit outcomes. The Events
dock will show the same evaluator evidence. No simulation control writes
Chronicle progression, and saving retains authored behaviors rather than the
transient playback state. Browser qualification must create a behavior through
visible controls, observe its delayed rendered effect, reset, save/reload and
repeat it; a numerical clock or event log alone is insufficient.

## Parametric room correction design

The existing Room feature editor retains its feature selector and measurement
fields. A separate Add room features disclosure creates named, editable generic
models for the supported feature classes. Correct or remove this feature
distinguishes a semantic label correction from rebuilding the actual geometry
as that type. Rebuilding retains the chosen name, footprint and pose. Removal
and rebuilding reject features supporting attached clues; the whole floor
cannot be deleted or duplicated. Undo/Redo and ordinary Save remain canonical.

A known width, height or depth of the selected feature uniformly rescales the
approximate room and its environmental furnishings. The reference measurement
is retained without declaring the other inferred dimensions measured. Authored
clue sizes retain their metres, and surface-bound clues follow the changed
support. Changing the reference's dimension clears the obsolete reference.
The correction interface must remain usable on phone, and browser evidence must
show the real rebuilt geometry, bound-support rejection, scaled clue/desk,
history, desktop reload and phone edit/reload. Doors and windows in this
checkpoint remain generic visible forms; real wall openings and photo
perception are still separate work.

## Protected photo room workflow (candidate qualification pending)

Bounded Watchglass observation data now maps deterministically to the same
Parallax room features: one complete floor, four inferred walls, a ceiling and
generic classified furnishings. The mapper rejects geometry beyond the room,
unknown or duplicate feature matches and uncertain same-room alignment. An
additional view must identify an existing shared feature; matching features
retain their geometry/support identities, and Creator corrections and known
measurements take precedence. Eleven focused tests cover these boundaries and
actual bound-clue correspondence after refinement.

The candidate Inspector now connects private photo import, uncertainty review,
ordinary saved Apply, same-room additional-view refinement and individual
permission withdrawal after reload. Availability remains conditional on the
existing private storage/scanner configuration and OpenAI allowance. No provider
configuration or scanning requirement is weakened to obtain a passing capture.

The server integration extends the existing Sealed Hold purpose registry
with `SPATIAL_ROOM_RECONSTRUCTION`, subject `SPATIAL_ROOM_DRAFT`, owner-only
audience and explicit `PHOTO` plus `EXTERNAL_AI_ROOM` consent. This authorizes
only sanitized, checksum-bound imagery for the chosen owned scene. Existing
private storage, scanner, object/media records, derivatives, transformation
receipts and grants remain canonical. Original and derivative scans must be
clean; missing provider/scanner configuration fails closed. No additional
scanner service, cloud secret manager or second image storage is introduced.

The consent describes OpenAI processing, expires after 24 hours and can be
withdrawn independently of geometry already authored. Source photographs remain
private Sealed Hold objects governed by existing withdrawal/retention; expiry
is an authorization deadline, not a claim of immediate byte deletion. Creator
photo import is distinct from Player calibration and public media release.
Watchglass produces bounded evidence, Parallax validates an editable proposal,
and an exact saved-scene comparison plus ordinary Save/CAS gates application.

The existing OpenAI provider adapter owns both structured observation dispatch
and exact multimodal input counting. The ordinary quota ledger reserves the
configured input/output ceiling before generation, releases rejected counting
requests and settles provider-reported usage. Counting sends the same authorized
image input to OpenAI; no image bytes, source storage keys or credential enter
ledger results. This uses the official [input token count API](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count)
instead of assuming undocumented image tokenization for the selected model.
The actual renderer opens camera-facing walls and ceilings as a display-only
cutaway; full geometry and whole-wall placement candidates remain canonical.
Proposals retain ordinary Save/CAS and editor-generation checks. Native room
quality, live vision accuracy and protected production qualification remain open.

The dedicated photo walkthrough uses an isolated SQLite database, disposable
private filesystem, existing synthetic scanner, synthetic images and intercepted
OpenAI responses against an owned development server with a separate build
directory. It records `DEVELOPMENT` and `SYNTHETIC_UNPAID` explicitly. Production
room-correction captures continue through the normal browser authority and
exercise configuration-unavailable photo fallback. Neither packet establishes
real scanning or live image-perception quality.

The bounded development photo journey now includes actual proposed geometry
preview, return to the original scene, saved Apply, shared-desk refinement,
individual withdrawal and final reload with no permissions. Its independent
receipt is recorded in the room/library/simulation review. Editable-room doors
and windows derive coplanar wall openings consumed by the same renderer and
surface discovery; the wall retains one identity and placement excludes voids.
Detached or perpendicular features do not cut a wall. This is generic modeled
geometry rather than measured architectural or operable-window qualification.

The Assistant's saving acknowledgement remains distinct from a canvas check
bound to the exact saved draft rendered by the workstation. Pending or failed
renderers cannot confirm appearance. Each affected entity reports its actual
view status, and offscreen/occluded/unreadable objects offer the existing
selection and canvas recovery controls. Authored-hidden objects remain hidden.
Real request/review/save state transitions use Lanternwake's state timing and
motion preferences with finite visual changes, without synthetic progress,
artificial delay or a perpetual state spinner. This source change still needs
its rendered execution/presentation regression and independent review.

## Continuing interface refinement

The owner expanded the visual direction to the whole Studio working experience.
The current branch retains the blue workstation and existing panel layout while
adding an asset-only Scene Graph, one selected-object icon toolbar and contextual
commands for actual objects, graph entries, preset assets, saved definitions and
viewport navigation. Commands use existing editor history and persistence and
honor locked/preview/busy/proposal states. Menu keyboard entry, navigation,
dismissal and focus restoration remain explicit validation requirements.

The Inspector leads with selected-object identity and grouped settings; environment
construction/photo tools follow in a separate section. Navigation help is
progressively disclosed while manual/automatic placement remains visible.
Reusable SVG command icons, quiet rows and selected-state hierarchy replace
repeated textual actions. These source changes await fresh actual-browser
qualification and independent visual review; no new owner acceptance is implied.

The first combined interface capture at `ce13ff5d394d` passed real animation,
renderer recovery, reusable-object persistence, corrected room editing, all
forty preset captures plus four changed-angle artwork views, and simulation.
It did not pass the complete run: a preset category assumption prevented the
menu test from reaching Library/phone states; autosave replaced Drydock feedback;
a responsive surface scroll caught a renderer child during replacement. Raw
failed evidence is retained. The corrections preserve commands and assertions:
locate the preset by identity, flush edits before validating, and settle the
viewport before scrolling the stable canvas region. Fresh capture is required.

The second combined capture at `e3d3df37d230` retained valid source binding and
passed eight of ten journeys, including both surface/orientation journeys and
the previously failing Drydock completion state. The two remaining failures
were strict test-selector ambiguities: duplicate scene names in the saved
Library, and a partial layout label also matching the new reset icon. Tests now
target the currently open scene and the exact layout combobox. Graph/viewport
keyboard commands, asset menus, and all room captures passed their assertions
before the menu test stopped. The full menu/phone and immutable-pin journeys
still require a successful complete rerun. Raw failures and recordings remain
under the source-bound engineering evidence folder.

The third combined production packet, `5dfc74230385`, completed all ten journeys
with valid source binding. The subsequent development-only photo journey
reviewed and saved the constructed room, then stopped on a historical three-part
cutaway count: complete walls now include skirting, so five architectural parts
were hidden. Its assertion now compares exact camera-facing shell identities.
This does not yet establish subsequent refinement, consent withdrawal or reveal.
Actual inspection also found beige global styling on light portal menu buttons
and upper-wall interference from fixed phone toolbar positions. Scoped menu
styles and a flowing camera/tool stack repair these visual issues without
shrinking the scene or removing commands. Changed states require recapture.

Component checks during the last repairs became timing-sensitive. Raw diagnostic
counts are retained with the `5dfc74230385` packet. Instrumentation identified
whole-editor accessible-role searches taking several seconds per lookup; test
queries now use exact accessible labels and native text targets while retaining
behavior, persistence, focus and visibility assertions. Full-workstation
integration cases have explicit 30-second component-test budgets, based on a
29.74-second passing isolated check of the original committed graph case. Browser timing and
product performance are separate from this component-test diagnostic. The final
component run passed all eleven cases (169.59 seconds of test execution); prior
timing failures remain recorded rather than treated as browser qualification.

## Final interface checkpoint and owner review

Candidate `5ad0dd413bf0b6ca81488416b45b06df23fe5014`, tree
`52cee3aa63ba442744ac826704446bbfebb88268`, passed all ten isolated
production-browser journeys. The same candidate passed the separate synthetic
development photo workflow, including shared-desk refinement, both permission
withdrawals, saved hidden letter, actual five-second reveal and reload/replay.
The [source-bound packet](../../Testing/Product_Experience/evidence/parallax-construction-20261012/5ad0dd413bf0/run.json)
contains 103 actual application images and fourteen recordings. Original JSON
receipts are retained alongside semantically equivalent formatted copies; every
recording checksum and copied media byte was verified. No paid inference was
used in either run. These checks establish local workflows, not live image
interpretation, scanner qualification or representative-device GPU performance.

The owner directly answered **“Accept these refinements”** when reviewing the
Scene Graph, contextual menus, Inspector hierarchy and phone layout in the
exact candidate gallery. The [acceptance receipt](../../Testing/Product_Experience/evidence/parallax-construction-20261012/5ad0dd413bf0/owner-ui-acceptance.json)
records that bounded UI acceptance. It does not grant full A–P, physical or
protected integration acceptance.

A separate owner preview on `http://127.0.0.1:3130/studio/parallax` uses an
isolated synthetic SQLite fixture and the shared Windows user credential only
in the server process. Authentication and safe Studio diagnostics returned 200,
configured/available/enabled true and thirty remaining requests. Automatic paid
calls were zero. Its fixture policy permits Luna low, thirty requests and a
$0.10 total allowance; the earlier port-3000 preview remains untouched. This is
a local inspection runtime, not deployment or a migration of shared state.

Ordinary protected experience planning still stops at
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
The separately owned Crossdeck capture lacks trusted hosted acceptance and
requires its own helper-lifecycle qualification. This task does not import its
unaccepted source, dispatch its capture or bypass the design gate. PR #722
remains a draft; full ordinary acceptance, protected integration and landed
verification are pending.

The independent [seventeen-dimension review](../../Testing/Product_Experience/evidence/parallax-construction-20261012/5ad0dd413bf0/independent-review.json)
returns VERIFY_FINAL_EVIDENCE for this bounded packet. The reviewer inspected
all 103 PNGs and sampled the complete chronology of fourteen recordings before
frozen source; all media and recording hashes match. PX-CONSTRUCT-01, phone
upper-wall readability and light menus are repaired. Three blank auxiliary
recordings provide no action evidence; their substantive paired recordings do.
The first photo-letter reveal uses actual elapsed playback; the post-reload
replay jumps the clock with Preview next delayed action. Unclicked commands,
full keyboard/screen-reader matrices, live vision, native/physical readiness
and complete overhaul acceptance remain explicitly unqualified.

## Owner development-homepage failure and repair

The owner subsequently reported `Scene host registry is destroyed` on the
fresh port-3130 homepage. The earlier HTTP sign-in/Studio diagnostics did not
test client hydration and missed this error. A new real-browser check reproduced
the same failure with zero mounted scene hosts. A root Strict Mode component
regression also failed with the same registration stack. Existing tests wrapped
only the child SceneHost, leaving the provider's replay lifecycle untested.

The provider's effect cleanup permanently killed its memoized director and
registry during React's development setup/cleanup/setup replay. Cleanup now
defers their irreversible disposal by one microtask and checks the generation
of that exact authority. Synchronous replay retains it; final unmount still
destroys it once, and destroyed registries still reject new registrations.
Host/target ref teardown and motion-root cleanup retain their normal behavior.
No registry guard or React Strict Mode setting was weakened.

All 65 focused provider/director/host/registry tests passed. The diagnostic
browser check then observed one live homepage host, READY Studio rendering,
an opened usable Assistant with configured/available true, and error-free
homepage return/reload. It typed but did not submit an instruction. These are
development-runtime checks; fresh source binding and bounded independent
review of the repair are recorded separately from the accepted 5ad UI packet.

The [committed repair walkthrough](../../Testing/Product_Experience/evidence/parallax-development-homepage-20261012/7706c72ff5ae/verified-repair/readiness.json)
binds candidate `7706c72ff5aeff328dd417cf9e8e24a800c214cc` and tree
`f59ff5cc679dd5bec6a2956baaf6a33635d33f56`. Its source stayed clean throughout
the actual sign-in form, Creator Studio navigation, READY scene, usable
Assistant composer and homepage return/reload. No client errors or error
overlay occurred; no inference was submitted. The [manifest](../../Testing/Product_Experience/evidence/parallax-development-homepage-20261012/7706c72ff5ae/manifest.json)
retains the original failure and an intermediate diagnostic-harness failure
caused by a shadowed constant. That intermediate packet remains failed;
the fresh corrected harness run passed. This checkpoint adds development
availability evidence rather than protected or whole-overhaul acceptance.

The separate [independent repair review](../../Testing/Product_Experience/evidence/parallax-development-homepage-20261012/7706c72ff5ae/independent-review.json)
returns VERIFY_FINAL_EVIDENCE across seventeen dimensions for this single
desktop/reduced-motion route. It inspected all five stills and all three
sampled recording chronologies before frozen source, confirms the before/after
hydration failure and usable Studio, and grants no inference, full device/mode,
physical or protected acceptance. The accepted 5ad interface and this runtime
repair retain distinct source identities.

## Completion audit after the homepage repair

The mandatory scenarios remain individually accountable. The source-bound 5ad
production packet and separate development photo/homepage packets establish
bounded journeys; they do not establish the entire A–P matrix at the current
candidate. Owner acceptance covers the specified interface refinements only.

| Scenario               | Current evidence and remaining qualification                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — AI visibility      | At 6c892c, actual note geometry is IN_VIEW before Apply; canonical Apply, saved renderer confirmation, graph/Inspector identity in all three modes and reload pass. Final combined production qualification remains open.                                          |
| B — Semantic placement | At 6c892c, the exact note-on-table-near-window instruction resolves the uniquely closest authored table and saves its fitted pose. Synthetic upstream interpretation is verified; live model quality remains separate.                                             |
| C — Ambiguity          | At 6c892c, two equally plausible tables produce a named clarification without Apply or scene mutation. This is a real browser/server journey with guarded synthetic upstream replies.                                                                              |
| D — Manual clamping    | Real table/Y-axis drag previews and clamps on release; disabling Clamp preserves free position. Undo/Redo, clear support and saved clamped restore pass at b15bca. Full physical or multi-surface drag qualification is separate.                                  |
| E — Selection          | At b15bca, graph selection and an actual viewport raycast select Second clue, agree with Inspector identity and show selected outline; framing and saved restore pass in this bounded desktop fixture.                                                             |
| F — Timeline           | Actual rendered position/rotation, scrub/play/pause/restart/stop and reload pass in the production animation journey.                                                                                                                                              |
| G — Simulation         | Matching and unmatched triggers, actual scene effects, delayed reveal and reset are captured.                                                                                                                                                                      |
| H — Photo room         | Development synthetic images exercise preview/refinement, known measurement, Apply, permissions and reload. Live image accuracy and configured production scanning remain unqualified.                                                                             |
| I — Reuse              | Versioned reusable definition, independent instance, archive and scene persistence pass bounded browser journeys.                                                                                                                                                  |
| J — Input              | Middle/Ctrl pan equivalence and preserved authored state pass the production input journey.                                                                                                                                                                        |
| K — Recovery           | Renderer failure/retry and retained draft pass; the separately repaired development provider lifecycle has its own evidence.                                                                                                                                       |
| L — Environments       | All ten deterministic constructions pass independent domain checks and have comparable actual renderer captures. Semantic querying across the complete set remains a separate requirement.                                                                         |
| M — Assistant truth    | Current actual success/clarification/cancel/failure transitions pass three development journeys. Independent review found clipped cancellation feedback; e5084c separately repairs and recaptures it. No fabricated model reasoning or server progress is claimed. |
| N — Visual quality     | All ten rooms and measured renderer costs have independent bounded review. Complete production prop/material/loading quality and representative device performance are not certified.                                                                              |
| O — Combined replay    | The combined desk/window-bound map saves and reloads identical authoring state, plays restored motion and repeats inspect/hide/editor-reveal in the 67bfe development journey. Full production qualification remains open.                                         |
| P — Modes and motion   | Current normal-motion recording checks all three authoring modes and Engineering renderer failure/retry; light phone fallback return and reduced-motion combined workflow pass. The complete device/mode matrix remains open.                                      |

The local completion audit found the independent construction inspector could
pass outward-facing wall supports and clearly unusual furniture height. It now
reports exact-part wall/rotation corrections and broad realized-height review
warnings without treating confidence as geometric validity or blocking intentional
miniatures. The focused construction/room suite passes 65 tests. This repair
does not discharge the remaining locally attainable browser requirements above.
The Crossdeck experience-design gate independently prevents ordinary protected
integration; it is not a reason to skip those local requirements.

## Continuing owner authoring feedback

The owner reports slow editing, difficult source-tree renaming, disappearing
assets during settings exploration and unclear/instant timeline motion. The
candidate caches one environment/surface collection across unchanged room
geometry and resolves all fixed/parented entity poses in one traversal. Static
validation and saved-scene serialization no longer run for every receipt update.
Object mesh reconstruction is limited to the changed prop rather than all props.
These are structural work reductions, not representative hardware FPS claims.

Scene Graph renaming uses F2, double-click, a pencil toolbar command or context
menu and one normal history edit on commit. Optional propStyle preserves a
renamed map, letter, footprint or compass's appearance; historic documents keep
their omitted optional-field representation and immutable versions are untouched.
This field qualifies browser presentation only; native art quality is separate.

Disappearance recovery uses explicit editor visibility override and isolation,
leaving saved hide events/audience and runtime state unchanged. Selected-object
framing scales its near plane and minimum distance to actual bounds, including
small props. Non-scale gizmo operations preserve the existing world scale.

Timeline bars represent the existing keyframe span, with live local pointer
feedback and a single history commit on release. Moving shifts times; edge
resizing retimes the actual keyframes. No parallel clip/runtime engine is added.
Instant behavior markers remain distinct from motion duration. Context menus,
keyboard timing and lock guards accompany pointer control. The motion starter
creates two distinct poses; single-frame and Step controls explain why those
choices hold or switch a pose rather than interpolate. Focused development
checks and source-bound rendered review are still required for this checkpoint.

## Authoring feedback qualification checkpoint

Frozen repair candidate `67bfe522668ab24c6a3fde37551d6dff9f9e6f86`, tree
`9a557232d9b0f0fd7b7f5b364458f249b62d6681`, passes all three isolated
synthetic development-browser workflows. The [repair packet](../../Testing/Product_Experience/evidence/parallax-authoring-feedback-20261013/saved-replay-repair/manifest.json)
contains current images, recordings and original receipts. Product source is
unchanged from `19c40ef7`; the repair extends the saved combined-scene test.
The first [seventeen-dimension review](../../Testing/Product_Experience/evidence/parallax-authoring-feedback-20261013/independent-review.json)
requires actual animation playback after reload (PX-AUTHOR-REPLAY-01).
The fresh recording now includes that playback before reset/inspect/hide/reveal;
the [bounded independent re-review](../../Testing/Product_Experience/evidence/parallax-authoring-feedback-20261013/saved-replay-repair/repair-review.json)
returns VERIFY_FINAL_EVIDENCE and closes PX-AUTHOR-REPLAY-01. The restored
view partially occludes the map with a wardrobe; its edge visibly moves, so
this is movement/continuity proof rather than an unobstructed art-detail review.

The saved map retains keyframes at 1 and 5 seconds. Eight actual renderer
samples after reload show interior x positions between 0.671675 and 0.7477125,
from a 0.64 starting position. Semantic desk/window references and inspect/hide
behavior persist. Editor reveal and repeated playback leave the saved document
identical. A 0.01-metre, distant object is recovered without moving its authored pose.

The five-footprint case rebuilds one prop on rename, retaining footprint style
and triangle count. The compass case records an edited 0.5-metre endpoint,
explains Step, then shows intermediate Linear motion in all three authoring
modes. Renderer failure/retry keeps Engineering selected; light phone fallback
return renders the compass. These bounded software-rendered journeys do not
establish representative GPU speed, native prop fidelity or owner acceptance.

Nine focused files pass 74 tests; changed ESLint and TypeScript checks pass.
Hidden Diagnostics previously recomputed all ten room previews during playback;
it now computes only when requested. Room discovery, pose resolution and
renderer updates retain cached inputs. Prop rebuild counters and renderer
submission costs are engineering evidence rather than hardware FPS.
Replacement renderers now receive state when React batches LOADING/READY
through the same final status. Component and actual-object browser checks cover
that fallback initialization edge.

The packet preserves the initial performance failure, collapsed-tab and
accessible-label harness failures, and a blank phone fallback return missed by
a weak canvas-presence assertion. The repaired phone check requires the actual
object IN_VIEW; earlier images and recordings remain for comparison. Original
receipt bytes and valid source binding are retained. Automatic paid calls are
zero. Full A-P, production/physical and protected integration remain open,
including real drag clamping and the current Assistant state matrix. The
Crossdeck design gate remains separately accountable.

## Direct placement and selection qualification

Candidate `b15bca335b028565ee2190a79eccfa6f5e6e47c6`, tree
`33ca774d32420e4f51ec56e3bfb174065903b64c`, passes the actual pointer journey
for scenarios D/E. The [source-bound packet](../../Testing/Product_Experience/evidence/parallax-direct-placement-20261013/manifest.json)
preserves five final stills, the complete recording, transform evidence and
original run receipts. The [independent seventeen-dimension review](../../Testing/Product_Experience/evidence/parallax-direct-placement-20261013/independent-review.json)
returns VERIFY_FINAL_EVIDENCE for this bounded packet, with no new blocker.

Moving a clue near a clear plane now highlights the receiving surface and
shows an aligned placement outline. Readable drag feedback names the target,
reports no fitting nearby surface or identifies free placement with Clamp off.
The authoritative surface query serves both preview and release. A valid prior
target is retained within 2.5 cm of the nearest alternative to prevent flicker;
fit, clearance and the existing 18 cm capture distance remain mandatory.
The preview changes no authored transform; release makes the normal history
edit. Cancellation clears the outline and restores the last authored pose.
Competing targets have domain coverage. Pointer cancellation is implemented
but remains unverified in a rendered journey; neither is claimed as a rendered
browser case in this packet.

The real Y-axis drag lifts paper above a table at 0.56 m. Releasing with Clamp
on restores its aligned tabletop pose. A second drag with Clamp off retains
its raised position. Undo, Redo and Undo repeat correctly before saving the
clamped pose; reload preserves that saved scene. This does not claim saved
persistence of the free pose. A separate graph selection then actual canvas
raycast both identify Second clue and synchronize its Inspector name and
selection feedback.

Four focused files pass 53 tests, including geometric fit, unsafe/oversize/far
rejection, nearby target retention and loss of valid support. Changed ESLint
and TypeScript pass. The three earlier authoring workflows pass at the same
product source. Three failed harness runs remain explicit: the first read the
new default draft instead of the selected saved identity; the second validated
against the unrelated fallback room; the third expected a field inside a
closed Inspector group. The final test follows the visible group control and
checks the correct saved definition and authored room.

This is one desktop Engineering/reduced-motion/dark synthetic table journey,
not physical surface tracking, all-axis/clamp combinations or representative
GPU performance. It closes the bounded D/E acceptance gaps while leaving the
current Assistant placement/clarification/cancel/failure matrix and other full
overhaul requirements active. No paid requests or shared runtime mutations were
made; both owner previews remain preserved.

## Semantic Assistant and preference continuity qualification

Candidate `6c892c682ea5b1b60e9bf0e8c800ac950ef64507`, tree
`6ec22b5d5602d5e970b9cb4e485c7f4519601418`, passes three isolated
development-browser journeys. The [original packet](../../Testing/Product_Experience/evidence/parallax-semantic-assistant-20261013/manifest.json)
retains 55 original artifacts, preceding harness failures and actual adverse
recordings. The independent review verifies 28 selected artifact hashes and
records all seventeen dimensions, with one bounded cancellation-feedback finding.

A Creator opens a saved two-table room through the ordinary Library and asks
for a note on the table near the window. The actual strict server proposal
resolves that feature relationship, displays the new note IN_VIEW before Apply,
then confirms saved geometry, selected graph identity and Inspector name in
all three authoring modes. Reload preserves the fitted tabletop pose and
unchanged original object. Two equally plausible tables instead receive a
named question without a scene edit. This guarded synthetic upstream fixture
proves the application workflow, not live model interpretation.

The actual browser exposed two additional defects. A Cancel click changed the
same button into a native submit action during that click, dispatching a second
request. Distinct keyed buttons, prevented default action and invalidated request
generation prevent resubmission and late proposal installation. Separately,
changing reduced-motion preferences replaced the entire route component tree,
resetting the Studio to a fresh default scene. The shared route boundary now
retains its mounted hierarchy while changing presentation policy. Studio
scene/composer continuity and the same public sign-in input/focus survive
preference changes in both directions. These do not claim every shared route
or physical device consumer is qualified.

Independent review found that safe cancellation still buried its notice below
the restored welcome content. Candidate
`e5084c724fde57c1bdbfee688aaac279a3465789`, tree
`6ee6027ab86d325073903737a42efb89badd4011`, gives cancellation an explicit
state and scrolls its feedback into view. The [separate repair packet](../../Testing/Product_Experience/evidence/parallax-semantic-assistant-20261013/cancellation-repair/manifest.json)
retains nine original artifacts. The browser now requires the notice in the
viewport immediately and after the full 5.5-second delayed-response window,
focused retained composer, one dispatch, no late Apply and identical saved
scene. Provider failure preserves Engineering and the rendered scene; switching
motion preference preserves unsent text before a successful fresh clarification.
The original independent finding and bytes remain unchanged.

The component suite passes 15 tests after the visible feedback repair. Prior
focused runs pass 91 domain tests, 74 client/port/service/environment tests
and 50 motion/client tests; these runs overlap and are not summed as unique
checks. Changed ESLint and TypeScript pass. Both complete browser captures
pass three workflows with VALID source binding. Automatic paid calls are zero.
The owning experience contracts now include the semantic, direct-placement and
authoring-refinement journeys while retaining all earlier obligations. Full
current production regression, the complete A-P matrix and ordinary protected
integration remain active.

The [independent cancellation repair review](../../Testing/Product_Experience/evidence/parallax-semantic-assistant-20261013/cancellation-repair/independent-review.json)
returns VERIFY_FINAL_EVIDENCE for PX-SEM-CANCEL-FEEDBACK-01. It verifies
all nine original artifact hashes, inspects six actual media and samples the
complete recovery chronology at 2 fps across 33 frames. All seventeen scoped
dimensions are recorded, with no further blocker in this bounded packet.
The complete raw receipt is preserved separately; owner and broader acceptance
remain ungranted. All 489 protected-base contract objects remain identical;
493 current contracts include this task's owned additions.

## Current production regression checkpoint

Candidate `0d7a5bed92c75949e60eed8287b578b861aece2f`, tree
`116e42c90557844ae04d0c6b5212d84d8423f590`, passes all 25 browser
journeys across sixteen Studio test files in 3.1 minutes. The [retained checkpoint](../../Testing/Product_Experience/evidence/parallax-production-regression-20261013/checkpoint-0d7a5bed92c7/manifest.json)
contains 258 original artifacts, including 205 stills and 36 recordings,
with VALID source binding. This is a historical checkpoint preceding the
landscape response-reading increment; it does not certify the later source.

The production run verifies actual animation and saved replay, canonical
simulation, inline rename and prop identity, direct dragging/selection, reusable
definitions, semantic placement/ambiguity/cancellation/failure, all ten rooms
and their classified features/transforms/surface definitions, both appearances,
all three authoring modes, responsive/floating assistance, daily request/cost
controls and public sign-in preference continuity. The room receipt ties each
classified feature to an instantiated renderer bound and discovered support;
class queries retain missing/ambiguity semantics instead of arbitrary selection.

The first broad run at 5104b915 passes 19 journeys, fails three and skips three
serial followers. It finds real landscape footer clipping and stale walkthrough
selectors. The clipping repair at a1bd9a75 passes the complete Assistant
presentation journey. Owner and workstation harnesses are updated to the
selected-object icon toolbar, exact accessible layout name, retained rail
state and saved-library naming. Focus must reclaim width/area and retain
height; its older hard-coded greater-than-750-pixel condition contradicted the
existing 750-pixel cap. These assertions remain meaningful and preserve
their visible-control journeys. A redundant same-source owner-only run at
6f920bc6 overwrites its earlier owner recording; the preceding combined run
receipt and unchanged workstation recordings survive, but that overwritten
owner recording is not claimed as retained.

The [independent short-window review](../../Testing/Product_Experience/evidence/parallax-short-window-assistant-20261013/independent-review.json)
verifies all thirteen original artifacts and seventeen scoped dimensions,
confirming the footer repair while requiring actual populated-response scrolling
for PX-SHORT-RESPONSE-01. A low-height wide Assistant now places its response
beside the bottom-aligned composer, with a focusable response region and narrow
window fallback. A new browser case uses real wheel and keyboard scrolling,
checks all review/composer actions and preserved scene state. Its first run
at a1486a10 passes six existing journeys but finds a partly clipped sticky
Apply button. Compact review actions now stay inside the response scrollport;
focused recapture and re-review are active.

Both owner previews remain live, and qualification uses an independent owned
checkout, dependencies, fresh nonce-checked SQLite and loopback runtime. All
automatic paid calls remain zero. The protected base is freshly verified as
602f83ef on 2026-10-13; adjacent PR721 remains open/draft. The separate
Crossdeck continuity design gate, current photo workflow, production prop
inspection and the complete A-P closure remain accountable.

The populated landscape repair at
`bdf2a9356709945b3181fbf20e97a54074dfe60f`, tree
`283162cc1b2f70e9e096c6c6c97672db86fb4134`, passes both production
Assistant workflows with VALID source binding. The new case records a
145-pixel response pane in floating and docked windows, 700 pixels of actual
wheel scrolling and a real Page Up return. Apply, both composer actions and
the focused input remain entirely in the viewport; saved authoring data stays
identical. The [separate populated-response repair](../../Testing/Product_Experience/evidence/parallax-short-window-assistant-20261013/response-repair/manifest.json)
preserves twelve originals including the earlier sticky-action failure.
Independent re-review and the complete 26-journey current-source regression
are running; the 25-pass checkpoint is not relabeled as newer-source proof.

The [independent populated-response repair review](../../Testing/Product_Experience/evidence/parallax-short-window-assistant-20261013/response-repair/independent-review.json)
returns VERIFY_FINAL_EVIDENCE for PX-SHORT-RESPONSE-01. It verifies twelve
original hashes and all seventeen scoped dimensions, inspecting six stills
and two complete recordings through 45 chronological samples. Actual Apply
and Reject mutation are outside this unchanged-scene scroll case; the separate
canonical Apply/persistence journeys remain authoritative.

The complete current production regression at the same bdf2a935 source passes
all 26 journeys in 3.2 minutes with VALID binding, including the new populated
landscape case. The current source-bound photo workflow is being refreshed
separately in its development-only synthetic private-media environment.

The [current production packet](../../Testing/Product_Experience/evidence/parallax-production-regression-20261013/current-bdf2a9356709/manifest.json)
retains 262 originals, 208 stills and 37 recordings. Its copied recording
hashes match the exact complete run receipt. The [separate current photo packet](../../Testing/Product_Experience/evidence/parallax-production-regression-20261013/photo-bdf2a9356709/manifest.json)
retains thirteen originals, eleven stills and one recording with VALID
development binding. Its one journey passes in 23.4 seconds.

The [independent photo review](../../Testing/Product_Experience/evidence/parallax-production-regression-20261013/photo-bdf2a9356709/independent-review.json)
verifies all thirteen hashes and seventeen dimensions, but returns
REPAIR_AND_RECAPTURE for PX-PHOTO-MEASURE-01. The manifest objective included
known-measurement correction; that operation is absent from this supplied
photo journey and recording. The original overstatement and first finding
remain preserved, rather than being silently relabeled as acceptance.
Proposal geometry, same-desk refinement, permission withdrawal, saved restore
and the first timed letter reveal are verified within the synthetic scope.
Post-reload replay uses a labeled shortcut. The recording lasts 23.560 seconds;
21.9 seconds was the reported test execution duration. Map-like parchment is
labeled a folded letter without folded-letter art acceptance, and stale
simulation-reset feedback is retained as a nonblocking finding.

Remaining locally attainable work includes the actual photo measurement
control/edit/render/save/reload/refinement journey, representative asset
inspection at useful distances, and pointer cancellation proof. These gaps
are not discharged by the 26 passing current production tests. The separate
Crossdeck gate still prevents protected qualification; the full objective stays
active. Feature Catalog remains unchanged for this partial overhaul and its
ordinary corrections; all generators and validators must run before publication.
