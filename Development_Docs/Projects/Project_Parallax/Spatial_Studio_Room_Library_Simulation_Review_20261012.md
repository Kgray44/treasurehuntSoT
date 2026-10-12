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
