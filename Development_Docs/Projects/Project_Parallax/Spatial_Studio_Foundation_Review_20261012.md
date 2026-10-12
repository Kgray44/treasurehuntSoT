---
title: Spatial Studio foundation rendered review
audience: product-engineering
status: bounded-development-review
canonical_for: parallax-studio-foundation-review-20261012
last_reviewed: 2026-10-12
---

# Bounded objective and source

Verify actual entity animation, isolated interaction/reset, surface orientation,
phone controls and camera recovery in the existing Spatial Studio. This is a
development checkpoint within the [full overhaul](Spatial_Studio_Overhaul_20261012.md),
not full A–P acceptance, native-device qualification or owner acceptance.

Candidate `e8f96bcd436afed3ff2d2c0f700d688eb21ba85a` passed four isolated
production-browser journeys. Its [manifest](../../Testing/Product_Experience/evidence/parallax-studio-foundation-20261012/e8f96bcd436a/run.json)
records the exact tree, lock digest, recordings, exit status and VALID source
binding. The provider was SYNTHETIC_UNPAID. Each run owns its database and ports;
the owner's preview and data were preserved.

Independent reviewer `/root/studio_foundation_review` inspected all screenshots
and recordings before frozen candidate source. Recordings were inspected through
decoded frames. Final disposition was **VERIFY_FINAL_EVIDENCE** for this bounded
foundation. The reviewer did not rerun the builder's tests.

## Repair history

| Candidate                                                                                                                                              | Independent observation                                                                                                                              | Disposition                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [4b3a1a8d50e1](../../Testing/Product_Experience/evidence/parallax-studio-foundation-20261012/4b3a1a8d50e1/run.json)                                    | Animation object outside useful framing; portrait selection controls crowded the scene; WebGL retry lost chosen framing.                             | REPAIR_AND_RECAPTURE                                                   |
| [e770e0a2e235](../../Testing/Product_Experience/evidence/parallax-studio-foundation-20261012/e770e0a2e235-invalidated/source-binding-invalidated.json) | Source changed during capture.                                                                                                                       | INVALIDATED; diagnostic record only, no exact-candidate outcome claim. |
| [1e7715fbf6dd](../../Testing/Product_Experience/evidence/parallax-studio-foundation-20261012/1e7715fbf6dd/run.json)                                    | Visible animation and recovered framing repaired. Portrait selection card remained too tall; full-page landscape capture distorted the fixed picker. | REPAIR_AND_RECAPTURE                                                   |
| e8f96bcd436a                                                                                                                                           | Compact portrait row retained all actions; Frame selection showed the wall clue; actual 844×390 picker showed choices and Close.                     | VERIFY_FINAL_EVIDENCE, bounded objective only                          |

## Required experience dimensions

| Dimension    | Concrete review finding and limit                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Composition  | Existing workspace remains readable; portrait canvas has usable height and a compact selection row.                        |
| Hierarchy    | Primary left icon rail is authoritative; Grid and Clamp remain independent tools.                                          |
| Spacing      | Portrait selection card no longer inherits the tall column layout.                                                         |
| Typography   | Desktop labels are readable; mobile hints and timeline labels remain small.                                                |
| Contrast     | Captured dark theme is readable; complete light-theme audit remains outside this packet.                                   |
| Controls     | Visible frame, surface, playback and retry actions execute in recordings.                                                  |
| Consistency  | Existing inspector, timeline and editor actions are preserved.                                                             |
| States       | Real motion, hidden state, reset, failure and recovery appear in captures.                                                 |
| Feedback     | Actual renderer receipts corroborate visible transforms; receipts alone are insufficient visual proof.                     |
| Responsive   | Portrait and actual landscape picker are usable; landscape requires document scrolling.                                    |
| Keyboard     | Modifier camera behavior is exercised; complete keyboard/focus acceptance remains open.                                    |
| Focus        | All actions retain accessible labels; comprehensive focus continuity is unverified.                                        |
| Motion       | Compass movement, pause/restart and hide/reset are visible; normal-duration comfort is unverified.                         |
| Continuity   | Renderer retry restores chosen framing and draft; ordinary refresh camera persistence is not claimed.                      |
| Complexity   | Surface options and explicit Close are discoverable; default phone framing can still put a clue behind tools until framed. |
| Role outcome | Synthetic Creator can animate, inspect, place and recover the actual scene.                                                |
| Fallback     | Retry and alternative editing guidance are actionable; physical/native fallback remains unqualified.                       |

The desktop animated prop remains small at animation-wide framing. The full
photo workflow, semantic natural-language placement, reusable assets, production
asset quality, reduced-motion/mode matrix and full A–P replay remain open.
Protected experience planning still requires the affected Crossdeck continuity
design; this record grants no protected capture or integration exemption.

## Editable-room follow-up

Candidate `78caeb961899ac5652868f107ab4a827bbe9ca64` passed 402 focused
Parallax tests and five isolated browser journeys. The same independent reviewer
visually confirmed moved/rotated desk geometry, its bound clue, expanded room and
saved reload, with no foundation regression. Classification/name edits were not
exercised and numeric depth showed floating-point noise. Disposition was
REPAIR_AND_RECAPTURE for the missing classification evidence, with numeric
formatting recorded as minor polish. Phone room editing and invalid-input states
also needed capture. The next candidate extends those journeys; no acceptance
for them is implied by this historical review.
