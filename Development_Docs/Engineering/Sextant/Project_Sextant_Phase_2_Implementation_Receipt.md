---
title: Project Sextant Phase 2 implementation receipt
audience: product-engineering
status: current-on-protected-mainline-acceptance
canonical_for: sextant-phase2-implementation-receipt
last_reviewed: 2026-10-10
---

# Project Sextant Phase 2 — Hold the Horizon

## Delivered plateau

The isolated implementation begins at protected-main `1c1f6bc828630d15664b93e38ab9ba36aab29730`. Crossdeck Phase 1 and Parallax Phase 1 are concurrent independent workstreams. This candidate supplies device context, without introducing pairing, AR tracking, visual hand interaction, camera capture or authoritative Chronicle progression.

| Phase 2 requirement                                     | Implementation and proof                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web orientation/motion providers                        | `web-provider.ts`: secure-context/API detection, shared event acquisition, class throttling, owned foreground/abort cleanup; event-family D1 scenarios                                                                                                                                             |
| Relative/absolute attitude and coordinate normalization | `attitude.ts`: normalized intrinsic Z-X-Y quaternion, inverse/composition/vector transforms, physical portrait frame and separate screen transform; basis-vector and singular-bearing tests                                                                                                        |
| Honest heading                                          | Relative alpha never becomes heading. Vendor compass is labeled magnetic; negative/unusable accuracy is rejected. Absolute-event north reference requires explicit qualified policy; default UNKNOWN provides relative fallback. No declination conversion or true-north claim by default.         |
| Linear motion, gravity and rotation rate                | Separate SI contracts for linear acceleration, acceleration including gravity, gravity difference and canonical X/Y/Z rad/s gyro mapping. Missing linear acceleration never gets fabricated from including-gravity.                                                                                |
| Stability and motion                                    | Continuous 600 ms quiet window, independent acceleration/angular thresholds, hysteresis, missing-channel and gap reset; UNKNOWN does not become false/stationary.                                                                                                                                  |
| Governed gesture engine                                 | Hold steady, relative turn, bearing alignment, rotation count, tilt band and slow sweep; validated thresholds/dwell/timeout, gravity-aligned angular integration, reversal/motion/speed rejection, interruption reset and mandatory alternative text.                                              |
| Consumer semantics                                      | Shared `webSextantRuntime`, `beginGesture`, `SextantGestureSession`, qualified envelope gating and one recognition per sample frame. No raw browser sensor API required in consumers.                                                                                                              |
| Contextual permission UX                                | User action invokes platform permission APIs synchronously; requests deduplicate while in flight; purpose/consent, denial/retry and late-grant pause races retain Phase 1 enforcement. `DeviceContextControls` provides keyboard-operable consent, status, pause/resume and an alternative action. |
| User status/pause                                       | Independent state projection with current freshness, suspended/unsupported/denied reason, screen angle, explicit foreground reacquisition and local pause/revoke controls.                                                                                                                         |
| Bounded haptics                                         | Semantic/basic web output and native-compatible adapter, authored visual/text alternative, user/reduced-sensory settings, foreground cancellation, consumer ownership, 500 ms rate floor, 600 ms on-time per cue and 3 s/minute fatigue budget. API acceptance is never physical confirmation.     |
| Battery-conscious arbitration                           | Existing shared provider/update-class arbitration, semantic delivery throttling, foreground-only cleanup and maximum 30-second high-fidelity burst lease. Event APIs expose no OS sampling-rate control; throttling reduces processing rather than claiming a physical sensor power reduction.     |
| Accepted Landfall migration                             | Landfall's public foreground context API now re-exports the same accepted behavior from `legacy-browser-context.ts`. Existing hint thresholds/permissions/1 Hz throttling remain; generic listeners share the Sextant acquisition hub. Position/native/navigation ownership remains unchanged.     |
| Device Lab D0/D1                                        | Four new deterministic semantic scenarios and seven browser/device API emulation scenarios, alongside all nine Phase 1 hooks. Source-bound platform v2 receipts retain simulation identity, tier fidelity, assertions and owned cleanup.                                                           |
| Optional Generic Sensor path                            | Deliberately omitted: the event-family provider covers this plateau without duplicate acquisition or another permission path. Generic Sensor/native/richer hardware adapters remain optional future implementations; no support is claimed.                                                        |

## Integration contract

One shared surface runtime must be used by device-context consumers. Construction, discovery and rendering the controls do not prompt or attach hardware sensors. The explicit consumer action supplies purpose, surface identity and consent; `acquire()` authorizes before leasing. `DeviceContextControls.onReady` lets the consumer acquire its own semantic leases. A resumed control does not silently resume a canceled gesture. Session/route owners release consumer leases, cancel owned haptics and dispose the surface runtime on Voyage end/sign-out.

Physical device frame is +X screen-right, +Y physical top, +Z out through display. Device attitude is independent of UI screen rotation. Observation timestamps use the shared monotonic receipt clock; the warning explicitly says this is not sensor capture time. Observations preserve unknown confidence, provider/calibration/quality/frame provenance and reference/gap discontinuities. The recognizer never integrates across a missing/stale frame or provider reset. High-rate observations remain local and ephemeral; status contains no raw stream or hardware fingerprint.

The 30 version-1 product definitions add distinct including-gravity and gravity-vector contracts to Phase 1's 28. Existing scalar heading, quaternion, moving/stability and compatibility contracts retain their value shapes. Capability implementation projection reports WEB_AVAILABLE only for implemented web semantics; rich haptics and later hardware remain FOUNDATION_ONLY. Registry support is not a guarantee of usable readings.

## Verification and acceptance

Focused implementation qualification passed 218 shared/Landfall/Sextant regression assertions after the inventory/receipt fixes, plus the final gesture/control additions. Source-bound CLI evidence passed all 20 scenarios with clean owned cleanup. Focused implementation qualification covers Sextant, shared Device Lab, accepted foreground Landfall behavior, sensor/runtime cleanup, consent controls, gesture false positives and haptic fallbacks. The shared CLI emits 20 source-bound receipts: nine preserved Phase 1 D0 scenarios, four Phase 2 D0 scenarios and seven Phase 2 D1 scenarios. Browser API emulation does not prove physical hardware, sensor accuracy, heading calibration, battery/thermal behavior, iOS Safari permission behavior or tactile output.

Ordinary Sounding Line on the frozen candidate is the mainline release decision. Protected merge and a landed-tree smoke check are required to close software implementation. This receipt grants no independent release authority; final verification and merge identifiers are recorded in the PR.

## Remaining program boundaries

Sextant Phases 3–5 retain magnetism, barometric/elevation/nearby semantics, native provider implementation and real hardware/field qualification. The v1.1 Reach camera lease requirements remain future camera work, with no camera pointing or capture qualification asserted by this phase. Crossdeck and Parallax consume this seam through their own governing phases.

## Platform reference baseline

The provider follows the [W3C Device Orientation and Motion model](https://www.w3.org/TR/orientation-event/) for intrinsic Z-X-Y rotation, device axes and permission/lifecycle behavior. Output follows the [W3C Vibration API](https://www.w3.org/TR/vibration/). API availability and command acceptance remain separate from physical capability/quality qualification.
