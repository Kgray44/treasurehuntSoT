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
| `1973a912`                                 | Four journeys passed: animation, camera/recovery, reusable library and Creator-authored delayed simulation with saved replay. Independent library re-review and new simulation review requested.                 |

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
both compass primitives. Final independent disposition is pending re-review.

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

The new independent simulation review is pending. Current evidence does not
establish full-condition graphs, material/light/effect animation, complete
cross-device operation or physical interaction. These are not substituted by
the successful numeric clock or event assertions. Protected experience planning
still requires the affected Crossdeck continuity design; no exemption is claimed.
