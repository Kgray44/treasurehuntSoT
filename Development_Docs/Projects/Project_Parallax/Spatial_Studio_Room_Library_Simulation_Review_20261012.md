---
title: Spatial Studio editable room, reusable library and simulation review
audience: product-engineering
status: bounded-development-review
canonical_for: parallax-studio-room-library-simulation-review-20261012
last_reviewed: 2026-10-12
---

# Objective and evidence boundary

This record covers editable room corrections, separate reusable definitions and
independent copies, and canonical simulation diagnostics within the
[active overhaul](Spatial_Studio_Overhaul_20261012.md). It does not close the full
A–P matrix, protected integration, photo reconstruction, native/physical quality
or owner acceptance. The owner's existing preview was preserved.

Actual authenticated production-browser runs use separate synthetic SQLite
databases, owned loopback ports and an explicitly unpaid provider. The committed
[evidence directory](../../Testing/Product_Experience/evidence/parallax-studio-room-library-20261012)
retains exact run manifests, PNGs and recordings, including failures.

| Source                                     | Outcome and boundary                                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `78caeb961899`                             | Five journeys passed; room classification/name and numeric error recovery were not exercised. Independent review requested more evidence.                                                                        |
| `52444f43ae07`                             | Five journeys passed; actual phone Inspector measured about 26 px wide and prevented room editing. Independent review required repair.                                                                           |
| `35823d95704cbd15d7760b2dc119e51d371c6093` | Five journeys passed. Independent room/foundation re-review returned VERIFY_FINAL_EVIDENCE after visible desktop and phone corrections.                                                                          |
| `67adfab5e0d2`                             | Five foundation/room journeys passed; reusable-library journey failed when the test closed an already-open identity section. Failure screenshot/context retained.                                                |
| `f4a1dac871de51b9d243cd7c34c061822f9ffccb` | Library journey passed; independent review found PX-LIB-01: an isolated definition camera leaked into the returned room.                                                                                         |
| `caa62c0a33564fbf9e512bbcbc8dd06a0e9f3b6e` | Animation/camera/library journeys passed, including restored room view and both objects IN_VIEW after archive. Simulation reached delayed hide/reset/save but the test collapsed its restored dock after reload. |
| `1973a912`                                 | Four journeys passed. Independent library re-review accepted PX-LIB-01; Simulation review identified PX-SIM-01/02 rendered-evidence gaps.                                                                        |
| `c5f7f69012f21278ced0ab57b3612d0ea034e61b` | Library and Simulation journeys passed. Independent desktop re-review accepted PX-SIM-01/02 repairs and retained library return/archive acceptance.                                                              |

The source-bound manifest records each full candidate/tree identity and lock
digest. A failed overall run is retained as failed even where individual
journeys passed. Frozen source inspection and actual visual/recording inspection
remain separate from the builder's tests.

## Accepted bounded room outcome

Independent reviewer `/root/studio_foundation_review` inspected all room and
foundation PNGs and decoded recording frames before source. At `35823d95`, the
Creator changes the desk's name and classification to a writing table, moves and
rotates it, expands the room, changes furniture depth, sees an invalid dimension
error and recovers. The actual table and bound clue correspond. Desktop save and
reload retain exact authored data. A 390×844 phone Inspector is about 311 px wide,
shows focused fields and accepts a saved position change before collapse.
Phone reload was not captured.

| Review dimension | Concrete accepted room observation and limit                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Composition      | Desktop room and bound clue remain recognizable; phone editor has readable width and collapses to the canvas. |
| Hierarchy        | Feature chooser, name/classification and measurements precede ordinary room editing.                          |
| Typography       | Rounded display values remove floating-point noise without changing stored precision.                         |
| Spacing          | Header and fields remain separated; the phone grid-column correction fixes the zero-width dock track.         |
| Controls         | Name, classification, position, rotation, dimensions, Save and Collapse are exercised.                        |
| Contrast         | Captured dark presentation is readable; complete theme/high-contrast acceptance is open.                      |
| Consistency      | Room edits use the existing draft/history/save mechanism.                                                     |
| States           | Edited room, invalid input, corrected value, saved desktop reload and phone edit appear.                      |
| Responsive       | Actual 390×844 room editing works; full device matrix remains open.                                           |
| Keyboard         | Numeric input and focus are visible; complete keyboard-only operation is unverified.                          |
| Focus            | Phone feature input remains in view; broader focus continuity is unverified.                                  |
| Feedback         | Error preserves finite geometry; clue movement agrees with the edited support.                                |
| Motion           | Recordings show actual geometry changes; normal-duration comfort is unverified.                               |
| Continuity       | Desktop reload retains authored room; phone save is proved, phone reload is not.                              |
| Complexity       | Room resize explanation identifies proportional positions and independent furniture dimensions.               |
| Role outcome     | Synthetic Creator can correct the actual room and retain the scene.                                           |
| Fallback         | Invalid measurements recover without corrupting geometry; physical/native fallback remains unqualified.       |

## Reusable-library repair

The `f4a1dac8` reviewer inspected all four library PNGs and its complete recording
before frozen source. Cards visibly distinguish the separately saved object,
its immutable release, classification/description and explicitly schematic
preview. Create scene copy, released insertion, Undo/Redo, instance rename,
Save/reload and unchanged source/release assertions support independent copies.

**PX-LIB-01, P2:** returning from the isolated definition left the camera aimed
at floor/table legs. The archive success and unchanged draft did not provide a
visible copied-scene result. Disposition: REPAIR_AND_RECAPTURE. The repair restores
a room perspective on definition-to-scene transition, preserves draft equality
checks and asserts actual IN_VIEW receipts for both objects after archive.
`library-archived-definition.png` at `caa62c0a3356` shows the complete room with
both compass primitives. Independent re-review at `1973a912` and regression
review at `c5f7f690` returned VERIFY_FINAL_EVIDENCE: both copied compasses remain
visible in the useful room overview after natural return/archive, without a
test-only Frame action. PX-LIB-01 is VERIFIED_REPAIRED.

Library review dimensions remain bounded to desktop dark theme and one built-in
object: composition and return continuity required PX-LIB-01 repair; hierarchy,
control grouping, metadata, feedback and definition/instance distinction were
readable; small metadata and long Inspector scrolling remain dense. Complete
mobile/keyboard/focus/theme, assemblies/multiple versions, adverse state and
imported-model qualification are not implied.

## Simulation checkpoint

417 focused Parallax tests pass, including evaluator timing/reset, audience
exclusion, bounded input rejection and legacy authoring/runtime behavior.
Changed lint and typecheck pass. The real Creator journey authors an
INSPECT/HIDE behavior with a one-second delay through Timeline, previews its
waiting state, observes the rendered compass disappear, resets it, saves/reloads,
runs timed playback to repeat the effect and exposes Engineering coordinates.
The same evaluator feeds timeline, Studio preview and canonical Lens.

The independent review at `1973a912` found PX-SIM-01: matched waiting/applied
results and Engineering evaluated coordinates existed below the captured fold.
PX-SIM-02 identified a tiny compass during saved timed replay. These were
rendered-evidence gaps rather than confirmed behavior-engine failures.

At `c5f7f690` (tree `b5e9d2ba10ba071fd630646cff432018c97875f9`), reviewer
`/root/studio_foundation_review` inspected all eleven PNGs and both recordings
before frozen source. The Simulation recording SHA256 is
`371173e409764835efa969c7ba279aea7a80ad9fe7f256dacaf6ce521de64861`.
Actual pane scrolling exposes inspect → Hide Floating Compass → waiting 1.0 s,
then evaluated · renderer: hidden. Ordinary Isolate/Frame precedes real elapsed
Run after reload; the large compass disappears and Reset visibly restores it.
The Engineering endpoint shows renderer in view and evaluated local coordinates.
Disposition: VERIFY_FINAL_EVIDENCE for the bounded desktop repair; PX-SIM-01/02
are VERIFIED_REPAIRED after one repair/recapture iteration.

| Dimension    | Independent Simulation observation and limit                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Composition  | Large compass and readable scrolled outcomes remain visible together.                                                             |
| Hierarchy    | Named match/no-match feedback appears near the shared clock.                                                                      |
| Typography   | Waiting/applied lines are readable; smaller Engineering identity is legible in full-resolution stills.                            |
| Spacing      | No captured desktop overlap; ordinary vertical pane scrolling is exercised.                                                       |
| Controls     | Author trigger/action/delay, Inspect, Preview delayed action, Run/Pause, Reset, Frame/Isolate and Save complete the loop.         |
| Contrast     | Dark desktop capture is readable; other themes remain unverified.                                                                 |
| Consistency  | Authored behavior, shared clock, real renderer state and Save retain workstation vocabulary.                                      |
| States       | No-match, waiting, hidden, reset, save/reload, elapsed replay and Engineering are visible.                                        |
| Responsive   | New Simulation/library phone and landscape journeys remain unverified.                                                            |
| Keyboard     | Semantic labeled controls exercised; complete keyboard-only journey unverified.                                                   |
| Focus        | Input focus partially observed; full traversal, return and screen-reader behavior unverified.                                     |
| Feedback     | Named guidance, matching confirmation, wait, renderer outcome and reset are visible; universal latency budget unmeasured.         |
| Motion       | Framed elapsed hide and reset visibly execute under reduced-motion emulation. Continuous-animation qualification is separate.     |
| Continuity   | Saved behavior survives reload; transient reset is clear. Library return/archive retains useful view.                             |
| Complexity   | One behavior is diagnosable through structured rows; larger scenes and many events unverified.                                    |
| Role outcome | One synthetic Creator completes the bounded desktop loop; owner/other-role outcomes unverified.                                   |
| Fallback     | No-match recovery and reset observed; quota exhaustion, suppressed layers, input exhaustion and renderer recovery not rerun here. |

Current evidence does not
establish full-condition graphs, material/light/effect animation, complete
cross-device operation or physical interaction. These are not substituted by
the successful numeric clock or event assertions. Protected experience planning
still requires the affected Crossdeck continuity design; no exemption is claimed.

## Parametric correction review: repair required

Reviewer `/root/studio_foundation_review` inspected all 51 PNGs and three complete
recordings at `03a11dd9aabe1d1b029a9dc889f760418e4a388c`, tree
`46bef4d63a5e3dbbe0ee9a11bf7640a3b4329ef8`, before frozen source. There are six
parametric stills, five room-feature stills and forty preset stills. The VALID
unpaid manifest and recording digests are retained in the evidence directory.
All three journeys pass, but rendered qualification is REPAIR_AND_RECAPTURE:

- PX-PARAM-01: bound desk Remove is visibly rejected; the contract also requires
  Rebuild rejection, which was not exercised. Add that ordinary action and
  demonstrate unchanged desk geometry and bound clue with readable guidance.
- PX-PARAM-02: the invalid room width preserves geometry, but the error guidance
  remains outside the captured Inspector viewport. Scroll the real alert into
  view before retaining its screenshot and recording.

| Dimension    | Observation and limit                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition  | Usable desktop loop and restored room. Immediate known-scale view clips its upper room until Reset view; phone canvas controls overlap its upper strip. |
| Hierarchy    | Three correction disclosures distinguish tasks; invalid error needs readable recapture.                                                                 |
| Typography   | Full-resolution names, values and limitations readable; small video status text weaker.                                                                 |
| Spacing      | Phone contextual Inspector retains full width; long forms require scrolling.                                                                            |
| Controls     | Add, classification, Rebuild, unbound Remove, history, scale, Save/reload and phone rename observed. Bound Rebuild still pending.                       |
| Contrast     | All ten presets readable in desktop/phone dark/light captures. Correction workflow itself captured only in dark.                                        |
| Consistency  | Canonical feature selector, history and Save; label/model difference corresponds to actual geometry.                                                    |
| States       | Chair, relabel, sofa, remove/restore, protected Remove, scale and reload visible. Both evidence repairs pending.                                        |
| Responsive   | Actual 390×844 feature rename/save and separate phone position edit usable. Phone Add/Rebuild/scale and landscape unverified.                           |
| Keyboard     | Input blur/Tab exercised; complete keyboard-only journey unverified.                                                                                    |
| Focus        | Visible edited-field focus; full order/return and screen reader unverified.                                                                             |
| Feedback     | Add/model limitations, bound Remove warning and measurement reference readable; invalid limits require recapture.                                       |
| Motion       | Actual geometry appears, rebuilds and changes through history. Physical performance and touch feel unverified.                                          |
| Continuity   | Room, scale reference, bound clue and phone name survive reload; Undo/Redo restores sofa.                                                               |
| Complexity   | Disclosed tasks and approximation explanations support this single-room correction loop. No photo or gesture reconstruction inferred.                   |
| Role outcome | Synthetic Creator loop substantially observed, awaiting two recaptures; owner and other roles unverified.                                               |
| Fallback     | Bound Remove recovery observed; bound Rebuild and invalid recovery need recapture. Budget exhaustion and physical survey unverified.                    |

Every named preset has distinct visible geometry on both tested devices/themes.
Trail reports the selected Desk Map occluded; environment presence does not
establish that every clue is visible. Generic openings do not cut walls and one
known measurement does not make the room a survey. Prior library/simulation and
foundation receipts remain bounded prior results, not reruns in this packet.

### First parametric repair recapture

The independent review of `56f17849a81dd53dcc2deba7c70f790dbcff7b06`, tree
`858e8c568b195d1b5bbfa1062cb4ff04f9a36fc5`, inspected all twelve stills and
both complete recordings before source. The VALID unpaid manifest records
two passing production-browser journeys. PX-PARAM-01 is VERIFIED_REPAIRED:
separate Remove and Rebuild attempts show readable guidance and unchanged actual
desk geometry and bound clue. Parametric recording SHA256 is
`78265935afdbb3812753f058099ebb1ea7e6b6441675322c8e94d0f1d682d057`;
room regression recording is
`5f935120e5eac309160195ea079aed219c7d78d3584ded94885130daf3822ef6`.

PX-PARAM-02 remains OPEN: ordinary scrollIntoViewIfNeeded did not clear the
Inspector header/scrollport, and native frames still show no readable bounds
message. This is a real recovery-presentation defect, even though invalid edits
preserve geometry. The second repair reveals validation feedback after native
blur/Tab scrolling, centered in the visible pane without moving focus. Browser
assertions now require actual alert bounds to clear the Inspector title and
stay within its scrollport. Recapture and independent review remain required.
The seventeen dimension observations and boundaries from the preceding review
remain applicable; feedback/hierarchy/focus still require that last repair.

### Second parametric repair: verified

The independent visual-first reviewer inspected thirteen PNGs and both complete
production recordings at `b54edb6bb68017b72c7754e848dab4994d7665a9`, tree
`40ca693759236f296c60a460f58d4636fce07c82`. The VALID unpaid manifest and media
are retained under the matching evidence directory. PX-PARAM-01 remains
VERIFIED_REPAIRED; PX-PARAM-02 is now VERIFIED_REPAIRED. The readable bounds
message clears the sticky Inspector header after native Tab/blur, and a finite
correction saves and reloads without changing the bound desk/clue relationship.
Disposition: VERIFY_FINAL_EVIDENCE for this bounded packet.

The parametric recording lasts 10.40 seconds, SHA256
`9c56d36cb1669417c911c1a9f5a334fe79f8860273160ef63f5f680577df7f89`.
The room regression recording lasts 6.92 seconds, SHA256
`7b6f79d48b8eb0f009eb05487c59a26470a5273a53210628f0922726fa2c6c50`.
The photo-unavailable still and actual manual continuation qualify only the
unconfigured production fallback. They do not qualify successful perception.

### Protected photo development walkthrough: bounded receipt

At `4c18aeedd0b809b2d7d9b273b6aaacaf61d2f9a3`, tree
`5a9e805eff12d8a7f25563b6766c9d739fd89629`, the independent reviewer inspected
all four PNGs and the entire 10.24-second development recording before source.
The manifest explicitly declares VALID / DEVELOPMENT / SYNTHETIC_UNPAID.
Recording SHA256:
`5a2b146fd0b796b89447cdb14c96f769744781d2a2383fe337e49da793553e5f`.
Disposition: VERIFY_FINAL_EVIDENCE for the bounded desktop journey, without
accepting the full protected-photo experience contract.

The initial proposal is textual: the original room remains in the canvas until
Apply. Saving renders eight editable features with four walls and a useful
cutaway. A second synthetic view matches the shared desk, retaining its identity
and moving it together with the clue. Individual withdrawal preserves geometry;
reload restores the refined draft and remaining permission. The final PNG shows
withdrawal pending; only the final native recording frames prove its completion.
Persistent denial after that final withdrawal was not tested in this packet.

| Dimension    | Production repair and development photo observation / boundary                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Composition  | Useful actual room/cutaway; proposal geometry was not previewed before Apply.                                  |
| Hierarchy    | Correction disclosures, readiness, consent, proposal and saved Apply ordered clearly.                          |
| Typography   | Full-size PNG guidance legible; scaled recording fine text and localization unqualified.                       |
| Spacing      | Error clears Inspector header; long photo form scrolls without overlap on desktop.                             |
| Controls     | Actual bound Remove/Rebuild protection, correction/save/reload, upload/refinement/withdrawal work.             |
| Contrast     | Dark workflow readable; configured photo light theme not captured.                                             |
| Consistency  | Canonical room identity, history and saved Apply; blue contextual Inspector.                                   |
| States       | Production unavailable/manual fallback and development proposed/applied/refined/withdrawn observed separately. |
| Responsive   | Manual correction works at 390×844; configured photo phone/landscape unqualified.                              |
| Keyboard     | Native field Tab/blur exercised; complete keyboard photo journey unqualified.                                  |
| Focus        | Validation reveals without moving focus; photo proposal focus/return and screen reader unqualified.            |
| Feedback     | Visible bounds recovery, estimated geometry, consent stages and retained-geometry withdrawal text.             |
| Motion       | Actual room and desk/clue transitions; reduced-motion fixture, no live inference timing proof.                 |
| Continuity   | Manual and refined photo geometry survive reload; final withdrawal persistence not proven.                     |
| Complexity   | Disclosed tasks support tested loop; long form and ordinal photo labels limit broader usability.               |
| Role outcome | Synthetic Creator desktop development workflow succeeds; owner/other roles unqualified.                        |
| Fallback     | Unconfigured/manual recovery works; configured clarification/cancel/failure/conflict not captured.             |

The earlier `b54edb6bb680` development photo run is retained as INVALIDATED,
exit 1: storage inside the checkout was rejected and development startup changed
tracked setup files. It is failed evidence, separate from that candidate's valid
production repair. The succeeding development fixture moved disposable storage
outside the checkout and froze startup configuration. Synthetic flat-color
images, scanner and intercepted OpenAI prove workflow rather than live vision,
real scanning, production provider readiness, native calibration, physical
correctness, complete overhaul or owner acceptance. Subsequent preview/opening
changes require their own capture and review.

### Actual room preview and wall opening: verified desktop development loop

The independent reviewer inspected all five actual PNGs and the complete
11.36-second recording at `13ba3ef6bf155cdda7078d4474610c2a11df63dc`, tree
`af25b3a0710bf1eaf946cf64807461bfcac9a458`, before frozen source.
The retained manifest declares VALID / DEVELOPMENT / SYNTHETIC_UNPAID / exit 0.
Recording SHA256 is
`5adc51b19aece8ad6c66154f6fa502afa59180b446482e285a1e73340c5ba26b`.
Disposition: VERIFY_FINAL_EVIDENCE for this bounded journey.

At 4.4–4.8 seconds the proposed back-wall window, room, desk and clue render
before saving. Return restores the original bedroom at approximately 5 seconds;
the second Preview restores proposed geometry. Saved Apply at approximately 6
seconds adopts that room. Refinement moves the same desk/clue, individual photo
withdrawals complete visibly, and the final reload retains the refined room
with zero permission controls. Full draft equality and real renderer receipts
corroborate visible continuity; both permissions are absent after final reload.

The preceding seventeen dimensions remain explicitly bounded. Composition,
hierarchy, controls, feedback, states, continuity and role outcome now include
actual pre-Apply geometry review, safe Return and completed final withdrawal
through reload. Typography/spacing/contrast are readable desktop dark mode;
keyboard focus, phone/light-theme photo workflow, non-reduced motion, provider
failure/cancel/clarification and stress density remain unqualified. The saved
Environment selector still names Bedroom during proposal preview while the
canvas and explicit status identify proposed geometry. Reset view is used for
the useful retained framing; automatic framing in every state is not inferred.

The visible framed window has segmented wall geometry around it. Pure checks
also establish rotated openings, floor-edge doors, detached/perpendicular
rejection and overlapping subtraction. Opaque stylized glass and this single
desktop view do not visually qualify see-through apertures, operable doors,
all rotated-hole placements or physical architecture. The full protected-photo
contract, live perception/scanning, production private-provider readiness and
owner acceptance remain open. Failed engineering packets `74612f1a432f`,
`03f13fb72c80` and `34f2eb31264c` retain their exit-1 manifests and actual
recordings; the first two stopped on receipt setup/preview-frame issues and the
third completed preview/refinement before a transient reload receipt read.

### Production presets and saved-canvas feedback: laptop repair required

The independent reviewer inspected all 80 actual PNGs and all six recordings
for `df4c4b9cb1cd0c7deeba948795b75f98e9e2180a`, tree
`53b31bedaf2ee40ff6aa047b6ed474c4b729348a`, before frozen source.
The retained run is VALID / SYNTHETIC_UNPAID / exit 0. Three substantive
recordings show presentation (23.12 seconds), presets (27.48 seconds) and
Creator/Chronicle continuity (15 seconds); three blank auxiliary recordings
provide no journey proof. Preset distinctness and desktop request/review/apply
continuity receive bounded VERIFY_FINAL_EVIDENCE judgments. Presentation
receives REPAIR_AND_RECAPTURE for PX-ASSIST-01.

At 1280×800, docked welcome and focused-composer captures clip Send idea below
the host. The old check compared controls only with the Assistant rectangle,
which itself exceeded its clipping ancestor. The smallest repair constrains
the docked host and flexes its inner panel, preserving the footer. The browser
check now intersects viewport and every clipping ancestor, tests Send's actual
hit target without scrolling, and submits a synthetic failure/recovery request
at that laptop size. This repair requires its own capture and independent review.

All ten presets have distinct furniture and compositions in dark/light desktop
and phone captures. Saved Apply visibly distinguishes canonical saving from
the exact saved draft's actual IN_VIEW renderer confirmation. Undo/Redo, reload,
refinement and exact immutable Chronicle pin reopening remain visible and
data-bound. Other post-save view/recovery states are source-tested rather than
visually qualified here.

The seventeen dimensions record: useful overlay composition except laptop
dock clipping; clear review/apply/result hierarchy; readable typography; grouped
spacing except that footer; meaningful labeled controls except clipped Send;
readable dark/light contrast; consistent authoring modes; actual pending,
proposal, accepted, failure, unsupported and quota states; desktop/phone/short
viewport coverage with laptop dock failure; composer/review focus and Escape
return but no full keyboard traversal; visible focus rings; truthful saved and
failure feedback; real finite transitions and reduced-motion welcome; actual
Undo/Redo/reload/Chronicle continuity; accessible small-fixture complexity;
successful synthetic Creator outcome with no Player qualification; and honest
provider/quota/manual/View canvas fallbacks. Non-desktop advanced modes,
complete motion matrix, screen readers, all post-save renderer recoveries,
stress density, live provider, physical/native quality and owner acceptance
remain unqualified. This does not accept the full overhaul or A–P matrix.

The first repair run `f663ef857069` retains its VALID, exit-1 receipt and actual
captures. Laptop docked Send visibly returns and submits the synthetic failure
request. The stronger test then incorrectly applied the ordinary center's
overflow clipping to a fixed phone window that escapes that ancestor; the
native capture shows its footer. The corrected check stops at the fixed host
and additionally hit-tests every footer control. Compact container spacing now
starts at 480 px to prevent fixed header/context/footer demand from overflowing
a short dock. This engineering failure is retained rather than treated as
visual acceptance.

The second engineering run `4dff21fbd513` retains its VALID, exit-1 receipt:
laptop and phone footer bounds and real hit targets pass, then landscape
reports the existing display-none Assistant history controls as clipped.
These have no rendered client rectangles; the Studio's normal Undo/Redo remain
separate controls. The assertion now filters only non-rendered controls, while
continuing to require the visible composer and Send action on every device.
No product control was hidden to make this check pass.

### Docked footer repair: independently verified

Candidate `d764cf5104c2ce886eb9249e93c6bc49d70b29cf`, tree
`a01f08a118034af89aa6c443627e1de9e400b51c`, retains VALID / SYNTHETIC_UNPAID /
exit 0. The independent reviewer inspected all 34 PNGs and three recordings
before frozen source. The substantive 23.40-second recording has SHA256
`2aae27f3523eed81844f2d5eec829143003bb6f08556134ef5e2839791f809a2`;
two blank auxiliary pages supply no journey proof. Disposition is
VERIFY_FINAL_EVIDENCE for this bounded repair; PX-ASSIST-01 is VERIFIED_REPAIRED.
The laptop footer now fits at 1280×800 and ordinary Send demonstrates pending,
readable unchanged-scene failure, retained request and new-task reset. Phone
and landscape retain complete visible composer actions.

All seventeen dimensions confirm overlay composition, clear hierarchy,
readable typography, fitted spacing, reachable visible controls, readable
dark/light contrast, consistent desktop modes, actual request/adverse states,
tested responsive configurations, visible keyboard composer/review focus,
Escape focus return, retained-request feedback, finite/reduced transitions,
preview/close continuity, understandable small-fixture complexity, synthetic
Creator recovery and honest provider/quota/View canvas fallbacks. Full keyboard
traversal, screen readers, every mode×device×motion combination, every post-save
renderer recovery, stress density and full contract/owner acceptance remain
unqualified. Preset and saved Creator judgments remain separately bound to df4c.

### Combined photo-room, hidden clue and actual timed reveal

Candidate `8ff7151731ee26819cc12073cde625fc7d61b3e1`, tree
`cb5e4516eb08500956f9a45c9dd879f427da8e23`, retains VALID / DEVELOPMENT /
SYNTHETIC_UNPAID / exit 0. The independent reviewer inspected all ten PNGs and
the complete 20.32-second recording before frozen source. Recording SHA256:
`69d3f7ff08d459bfe4b9a77a02656c1cec0831ee96404ec9f8187ff0563c30be`.
Disposition is VERIFY_FINAL_EVIDENCE for the bounded combined workflow.

After actual preview/return/apply/refinement and both photo withdrawals, the
ordinary Assistant changes the existing map into a named letter on the desk
beside the window, with an initially hidden layer and SCENE_ENTER→SHOW at
5000 ms. Canonical state stays unchanged before Apply. The saved result says
hidden as authored. Actual simulation playback shows no paper through about
4.8 seconds and reveals it around 5.1 seconds. Reload preserves exact geometry,
entity and behavior; delayed-action preview evaluates the saved reveal at
5.0 seconds. Reload does not demonstrate a second uninterrupted timed wait.

All seventeen dimensions record: useful cutaway/framed composition; separate
proposal/save/clock hierarchy; readable interface typography but unqualified
paper text; grouped scrollable spacing; actual consent/preview/apply/refine/
withdraw/Assistant/simulation controls; clear dark contrast; one consistent
editor and entity; explicit hidden/revealed states; desktop-only responsive
scope; labeled controls without full keyboard proof; visible selection/focus
framing; truthful hidden and uncertainty feedback; actual five-second timing
in reduced motion; exact saved/refined/reloaded continuity; understandable
single-room complexity; successful synthetic Creator outcome; and demonstrated
Return/withdraw/Frame/Reset recovery. Photo adverse states, multi-target
ambiguity, phone/light/advanced-mode matrix, screen readers, physical timing,
live perception/scanning and owner acceptance remain outside this packet.
The historical reset notice persists after playback; clock and object state
are current, but that notice is not a live reset assertion. The paper is still
a flat PARCHMENT surface in this receipt: renamed content does not qualify
folded geometry or production artwork. The supplemental construction standard
requires new construction, verification, performance and visual evidence.

### Combined construction and interface checkpoint

Candidate `5ad0dd413bf0b6ca81488416b45b06df23fe5014` has valid source-bound,
unpaid packets: ten production journeys and one separate development photo
journey pass. The [independent receipt](../../Testing/Product_Experience/evidence/parallax-construction-20261012/5ad0dd413bf0/independent-review.json)
records observations across all seventeen dimensions, 103 stills and fourteen
sampled recording chronologies. No additional blocker was confirmed within
that bounded evidence. All media checksums independently match; auxiliary
blank recordings, unclicked commands and sampling limits remain explicit.

The owner accepted the Scene Graph, contextual menus, Inspector hierarchy and
phone layout. Photo preview/Apply/refinement/withdrawal and the initially hidden
folded letter's first actual five-second reveal pass synthetically. Reload
retains state; the second replay jumps to the next delayed action and does not
prove a second uninterrupted wait. Production scanning, live perception,
native/physical qualification and comprehensive A–P acceptance remain open.
The later development-homepage lifecycle failure and its repair have separate
evidence in the [overhaul record](Spatial_Studio_Overhaul_20261012.md).
