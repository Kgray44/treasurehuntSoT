---
title: Reach target-three recovery diagnosis and registration correction
audience: product-engineering
status: development-repair-with-unresolved-automatic-recovery
canonical_for: reach-target-three-recovery-20261018
last_reviewed: 2026-10-19
---

# Reach target-three recovery diagnosis and registration correction

The [2026-10-19 bounded campaign](Overnight_Reliability_Campaign_20261019.md) is the subsequent investigation. It preserves this exact application's results while comparing additional perception candidates and separating controller admission from upstream identity loss.

After the `1c0194b7` preview handoff, the owner reported another physical calibration stall: relative target three, two saved targets, one hand detected, and **Fingertip tracking paused**. The screenshot establishes that visible state; it contains no packet trace proving the exact rejection cause. The camera had already stopped through the existing away-page lifecycle when inspected. The owner's screenshot and all recording imagery remain private.

The existing 74-second diagnostic recording reproduces an analogous failure. On the old `d44f6222` interpretation, all 89 RIGHT packets pass current source/freshness gates and contain one neural hand. The helper supplies 88 full-point anchors and one cropped-index cue, yet all 89 produce `LOST / APPEARANCE_MISMATCH` and no usable position. These are requested diagnostic poses, not a recording of the owner's later calibration UI.

## Distinct causes and bounded repairs

The old index-coordinate conflict clears coordinate registration. Current same-hand evidence keeps association alive, while the returning full-point cohorts remain unassociated. The old appearance bank cannot reprove the selected index, so `canReconfirm` and `modelFallback` never restore position. Baseline instrumentation exactly reproduces all 1,336 original output/readiness rows. It shows zero optical-registration calls during TOP, LEFT and RIGHT. By the end of RIGHT, the retained appearance evidence is over fifteen seconds old. Readiness is not an absorbing state: it can resume on fresh producer positions, but cannot invent those positions or establish the selected digit from a visible hand alone.

A separate, earlier registration defect can cause this state to develop. `registerCurrentOptical` treated offset between the neural tip and a material match as forward/backward loop error. It reversed the patch at the neural center instead of the actual forward-matched material, and required both differences to fit the same two-pixel bound. Legitimate four- and eight-pixel neural jitter therefore prevented optical reference registration even when material correspondence closed exactly.

Application commit `055b2a0baa66ed9bbd340b884e6c709cbc65d6de` fixes that registration error. Neural innovation retains the existing eight-analysis-pixel limit; actual material reverse closure retains the existing two-pixel limit. The registered template/coordinate origin and fractional phase remain at the current neural tip. Three frames over 120 ms, source context, forward rival separation, texture/structure requirements, final 150 ms freshness and transactional rollback remain enforced. The correction does not introduce a new reverse-rival gate, loosen a source alias or clear a disputed-index latch.

The temporal ledger also received an unverified model candidate's source as though it owned the selected finger. It now receives post-finalization selected-hand/canonical provenance. An already established, unchanged raw image track may retain only its identity clock during full-hand ambiguity when the current full-quality material match has advanced the association clock, with no entry, coordinate conflict or model disagreement. It remains `AMBIGUOUS`, with no actionable point, coast display, calibration samples or measurement/template/velocity updates. This does not extend the 150 ms measurement freshness bound or let a disputed image become valid after the model disappears.

A new integration regression exposed a second timer dead end: after prolonged foreign model ambiguity, the source helper expired and would quarantine even the original source forever. A bounded exact-source return now permits only the last actually verified model source to rebuild the existing three-frame/120 ms model probation when an established same-raw/canonical index has identity and image-association clocks no older than 250 ms, and current full-point anatomy coheres with the fixed reference and agrees with full-quality image tip consensus within eight analysis pixels. A new model ID cannot use this path. Stale material, different anatomy, rival patches, contrary intent, entry and coordinate conflict retain their independent rejection gates. Neither helper trust nor measurement history is renewed merely by entering the return path.

The producer remains version 4 / `TEMPORAL_INDEX_FUSION_V3`; the final descriptor digest is `00fc2b5cd07b6c54dc649ba4bc914f1327dbb3642fa02de6719fdc9b15710094`. Pinned neural weights, camera capture, hand rendering, frequency ceilings and raw independent accuracy requirements are unchanged. Appearance mismatch, competing matches, inconsistent correspondence and excessive motion now have distinct guidance. The closed diagnostics drawer also exposes the bounded **Current tracking decision** reason instead of requiring inference from generic lost-finger wording.

## Paired recorded-input comparison

The comparison uses the same 1,336 cached neural packets, immutable grayscale planes and measured capture/completion clocks from the actual 1x video replay. It executes current interpretation without new neural inference, live camera, browser, account or telemetry-store access. Both source/freshness gates admit every packet. Counts below concern produced positions and readiness, not packet freshness, correct-index accuracy, actual calibration progress or device throughput.

| Measure                                   | Old `d44f6222` | Corrected `00fc2b5c` |
| ----------------------------------------- | -------------: | -------------------: |
| Produced positions / 1,336                |            348 |                  504 |
| Readiness-eligible frames / 1,336         |            265 |                  416 |
| Logical identity changes                  |              8 |                    7 |
| First logical replacement, source seconds |         12.895 |               16.145 |
| CENTER positions / 109                    |             78 |                   78 |
| BOTTOM positions / 145                    |             64 |                   60 |
| TOP positions / 107                       |             12 |                   70 |
| LEFT positions / 90                       |              0 |                   87 |
| RIGHT positions / 89                      |              0 |                   13 |
| TOP_LEFT positions / 73                   |             27 |                   26 |
| TOP_RIGHT positions / 74                  |             46 |                   46 |
| BOTTOM_LEFT positions / 71                |             36 |                   36 |
| BOTTOM_RIGHT positions / 71               |             15 |                   13 |
| RELAXED positions / 109                   |             41 |                   41 |
| SWEEP positions / 180                     |              6 |                   11 |
| OPEN_PALM positions / 91                  |              0 |                    0 |
| HIDE positions / 18                       |              0 |                    0 |
| RECOVER positions / 109                   |             23 |                   23 |

The registration-only intermediate `5ee96601` produced the same 504 positions and 416 readiness-eligible frames, but ten identity changes beginning at 13.428 seconds. The final temporal/source changes reduce those events to seven without changing any produced point, state, reason, readiness eligibility or raw producer measurement history on these inputs. The established CENTER→BOTTOM logical identity now persists through fourteen source seconds. This is continuity evidence for diagnostic poses, not completion of live calibration targets.

There is a real LEFT recovery improvement with losses elsewhere. On the unchanged thirty nonblinded AI development pointing-tip references, twelve still have positions and nine are inside their annotation uncertainty circles. Two LEFT references become available and correctly localized; two earlier CENTER/BOTTOM references become unavailable. Conditional median camera-space error changes from 5.57 to 5.45 native pixels; maximum remains 18.85. Negative reference controls still have no points. This sparse comparison does not establish an overall accuracy gain or independent physical acceptance.

RIGHT still exposes a hard model/image disagreement. At its first new conflict, stable/adaptive matches agree within one analysis pixel on the visible index terminal surface while the neural tip lies about fifteen pixels away. Replacing the model's distal axis with longer neural axes does not bring that point inside the existing eight-pixel normal bound. A private optical-DIP-axis probe also fails existing distinctive-material proof: the apparent DIP match has correlation 0.968 but rival separation 0.000164, below 0.035. Its apparent correspondence cannot honestly be promoted into unique selected-finger evidence. No compatibility radius was widened.

## Rejected recovery shortcut

A private frozen index/palm geometry probe produced zero mature eligible recovery candidates on these 1,336 inputs. A constructive counterexample also passed its proposed eight-pixel/relative-shape bound: four plausible named index joints shift seven pixels while the palm remains unchanged. The actual adapter continues the same source with `INDEX_CHAIN_V1`, full pointing and four named joints across four frames. Those metadata are therefore insufficient to distinguish a plausible wrong-digit relabel from real index movement after old material correspondence is lost. Geometry-only reproof was not adopted. Ordinary hand continuity and nonactionable association must not silently grant a current selected-index coordinate.

The owner declined a proposed human-confirmation recovery option and requested automatic recovery only. No same-finger confirmation control is implemented. Existing **Track visible fingertip** selection still starts a fresh setup; a new selection does not automatically prove continuity to saved targets.

## Verification and remaining boundary

Five new registration regressions retain two pre-fix failing positive cases and cover four/eight-pixel innovation, excessive innovation, repeated rivals, fractional coordinate phase and image-only continuation after model dropout. The registration-only intermediate passed 1,568 tests in 87 subsystem files. Final application commit `2d03e6678c7af0d08775c67ea9afffa79e2f9ac2` passes 1,588 tests in those 87 Reach, Watchglass and Sextant files, with zero failed or pending tests. Added temporal/integration cases cover long ambiguity, original and actually proved alias return, cold/expired/replacement/foreign-source rejection, current-pixel rivals, stale material, contrary latches and conflict followed by model absence. No stale point or sample is accepted to pass those regressions.

Final source review independently found no blocking issue within the bounded change. The cached-input comparison was executed before the code commit, with immutable tracker/temporal hashes identical to that commit; its original receipt HEAD is retained rather than relabelled. The exact final tracker SHA-256 is `c3bfe20e82a4c9e6230b357bb2890b0eebf5add5930948f003e8b1bb8780ed56` and temporal SHA-256 is `6bcd6bd47b6d2cecddd339f927bd56929068c2533b13105eec9adce078ea4610`.

The normal production build passes at that exact code commit, verifying 6,433 tracked files against tree `95d28f46facef8b056066364d9dff8f8c8208dc0`; archive SHA-256 is `3fe6aad0b13d0bb449928422474a031528493a000068f554e841f51cc3e80c21`. Build duration is 74.24 seconds on this run, not an application tracking-cost measurement. Full TypeScript, scoped lint and formatting pass. Final source remains unchanged throughout both browser cohorts.

The first registration-only browser cohorts retained their failures: 11/12 index cases, with the original mixed-motion identity assertion still failing, and 15/16 Laboratory cases. The latter exposed a test fixture error and stale-pose race: the supposed cropped-open pose actually placed all 21 joints inside the image and correctly supplied no pointing eligibility. The corrected test acknowledges each injected pose revision only after three delivered results spanning 120 ms and two render frames. It explicitly requires the fully observed end-on unknown posture to remain noneligible, while retaining both genuinely cropped positives. No classifier or production admission threshold changed for this test correction. Original failure traces and screenshots remain preserved privately.

Final `2d03e667` browser results are **16/16 Laboratory** and **11/12 index**. Both separate full-hand and cropped-index target 1→2 transition cases pass. The Laboratory cohort covers desktop/mobile setup, held-out checks, playground, posture interruption, denied camera, unavailable model, viewport invalidation, local recorder privacy and actual pinned-worker photographic nine-target/five-check execution. It does not establish physical webcam pointing accuracy. The unchanged broad mixed-motion case still fails its one-identity assertion: its tracked generations include 1, 2 and 3. Its later assertions are not executed after that failure and are not counted as passed.

An independent reviewer inspected and hash-bound 34 final-source desktop/mobile synthetic captures across populated, empty, adverse, saved-target, recovery, check-result and playground views. No blocking rendered P1/P2 issue was identified in that bounded supplemental review. A cancelled-setup snapshot briefly retains prior saved-target readiness wording; persistence was not established. These local reviews do not mint formal experience acceptance.

## Mixed-motion search experiment retained as a failure

The original browser attachment contains 229 sampled UI rows and 184 current worker replies. An analytic replay reconstructing its declared raster and actual adapter inputs reproduces every sampled state/reason. During an unverified foreign-model pause, trusted coordinates and velocity correctly freeze. After the finger turns, its current material falls outside both frozen search squares and the 32-pixel displacement bound; the recorded decision is appearance mismatch, followed by continuity expiry. A diagnostic wider search finds the original material, so the reconstructed failure is consistent with search reach rather than destruction of appearance. Exact browser-bitmap equality was not captured, so this is analytic causal evidence rather than a bitwise camera replay.

A private bounded search-proposal prototype follows current stable material during model ambiguity while preserving the existing 250 ms gap, frozen 1,200 ms lifetime, rival comparison, reverse closure and foreign-source-proof exclusion. On 184 analytic inputs it increases produced positions from 57 to 79, with all produced points on the known synthetic tip. However, it raises logical replacements from two to three and still cannot prove later source aliases. On the separate 1,336 owner-recorded input rows it changes no position, readiness or identity count. It was **not adopted**. Availability alone does not justify worsening calibration identity, widening source proof or disguising the original browser failure.

Formal experience planning still refuses the changed trusted obligation `reach.phase1.foundation.absolute-calibration-and-recovery`; no protection, original assertion or qualification gate is bypassed. This is development work only. The owner's target-three completion, automatic long-loss recovery, difficult cropping/end-on poses and physical accuracy remain unproved. NCL, Crossdeck and Sounding Line stay outside this repair.

## Delivered testing preview

The exact built `2d03e667` source replaces the owned loopback preview at `http://127.0.0.1:3137/devices/reach` in the same Edge tab. Both owned Next/launcher exits and port release were observed before replacement. The entire previous private SQLite database was copied through a read-only backup and passed integrity checks plus identical logical projections for all four Reach tables, including 76 existing report windows and zero policy changes. The prepared synthetic fixture, original database, credentials and all previous evidence remain preserved. An initial path-separator check refused replacement before stopping either service; the helper was corrected to compare normalized paths without removing its ownership checks.

A bounded real-camera startup check in that tab reached **Camera connected**, GPU processing, 640×480 negotiated capture and 152 processed observations. The sampled diagnostic display showed 14.6 model updates/second under the unchanged 15 Hz normal ceiling, 3.3 ms main-thread work/frame, 9.9 ms capture→inference P95 and 22.8 ms capture→canvas-submission P95. These are one live startup observation, not a controlled benchmark, hand-accuracy result, gaming-load comparison or exposure-to-display latency. No pointing attempt was established. Camera capture was then stopped and the page left at **Enable live camera**, with no camera image in the delivery screenshot. The standard laboratory needs no sign-in.

The existing NCL HTTPS service still returns HTTP 200 with its CA and hostname verified, and its relay/upstream processes are unchanged. No browser Guided view is presented as native iPhone AR proof. Neither Crossdeck nor Sounding Line services were modified, and protected qualification was not initiated.
