---
title: Project Reach engineering home
audience: product-engineering
status: integrated-foundation-preview
canonical_for: project-reach-engineering-home
last_reviewed: 2026-10-17
---

# Project Reach engineering home

Reach is Voyagewright's reusable browser-first spatial interaction and intent system. Phase 1's browser hand laboratory, observation/coordinate foundation and independent calibration workflow are integrated as a foundation preview through [PR #697](https://github.com/Kgray44/treasurehuntSoT/pull/697), main commit `7284b0dfaa31037d074d27df0f27b968f3977000`, after the [required Mainline Decision](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38113725340) passed. Landed source/asset verification passed. Physical webcam and held-out calibration, accuracy, jitter, exposure-to-visible latency, ergonomics and owner acceptance remain open; full Phase 1 is not accepted. See the [implementation and validation record](Project_Reach_Phase_1_Implementation_and_Validation_Record.md). Later-phase target acquisition, selection, manipulation and owner integrations are not implemented by this phase.

## Effective governing sources

The [natural pointing and recovery development preview](Natural_Pointing_Recovery_20261017.md) responds to the owner's physical feedback with buffered holds, relaxed inferred-3D posture and bounded reacquisition. The owner follow-up on app `53128badc` repeatedly reset calibration, with four `CONTEXT_CHANGED` logs; software checks did not establish physical reliability. Local source `a450b244cbb2e5fa9643f74b0c794d07a1fa3ab5` adds bounded non-index model estimates up to 15% past an image edge, explicitly separate from observed joints, while required index/core geometry and raw independent 3% validation remain unchanged. One established history can survive brief unconfirmed overlap, secondary histories require repeated observation, ambiguity always pauses and established two-hand crossings still retire their identities. A visible index trace and **Index joints tracked** remain independent of confirmed pointing and calibration eligibility; an index alone cannot supply palm scale or indefinite source continuity. Genuine resets retain a persistent focused **Setup ended** alert.

Replay of 928 results from the owner-authorized private recording reduced source resets from three to one. Pointing-eligible interpretations in the three lower-position segments changed from 19 to 61 of 102 results, 14 to 39 of 46, and zero to 20 of 48. These are model/interpretation results, not verified pointing accuracy; SWEEP was excluded because the owner was not focused on that instruction. Fresh physical retest and owner acceptance remain pending. This local source is not protected integration or full qualification.

The explicit local recorder at `/devices/reach/record` requires `REACH_LOCAL_POSE_CAPTURE=1` and a loopback Host. Its separately started 74-second guide records nine distinct pointing holds, relaxed pointing, a sweep, open palm, brief hiding and recovery without fitting calibration. Manual video/trace downloads combine the existing hand overlay, camera/background and synchronized prompt/timing data; there is no audio, upload, account persistence or inclusion in ordinary aggregate exports. Keep recordings private and outside automatic repository commits. Prompt labels are instructions, not verified intent or ground-truth pointing accuracy. The standard laboratory remains video-free; the [guide](../../../docs/user/hand-laboratory.md#explicit-local-diagnostic-recording) distinguishes the opt-in exception.

The [recognition, calibration and experience refit](Recognition_Calibration_Experience_Refit_20261011.md) revises interpretation and the laboratory: detected hands remain distinct from posture/eligibility, an active hand can coexist with an incidental hand, stable acquisition survives brief interruptions, and relative movement has a separate setup and independent cursor check. Its record tracks qualification, rendered review and the remaining owner/physical walkthrough. The older Phase 1 record describes its original frozen protocol.

- [Reach governing document v1.0](../../Governing/Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md)
- [Spatial architecture v1.1 amendment](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Amendment_v1.1_Reach_and_Browser_First_Interaction.md)
- [Effective spatial authority and all owner amendments](../../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md)
- [Launch Manifest v1.1](../../Programs/Spatial_Experience/Voyagewright_Spatial_Experience_Wave_4_Implementation_Launch_Manifest_v1.1_Reach.md)
- [Interaction/gesture/scenario registry](../../Spatial_Experience/reach-interaction-registry.json)
- [Requirements traceability and qualification plan](Project_Reach_Requirements_and_Qualification_Plan.md)

## Five implementation phases

| Phase | Name                 | Independently useful outcome                                | Acceptance boundary                                    |
| ----- | -------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 1     | Find the Hand        | Browser provider, calibration and live laboratory           | Real webcam trials and independent validation begin    |
| 2     | Take Aim             | Registered targets, precision pointing and stable selection | Qualified acquisition; ambiguity abstains              |
| 3     | Get a Grip           | Constrained manipulation, hold/release and recovery         | No loss-induced action, bounded transforms             |
| 4     | Bring It to Life     | Available real UI/domain integrations                       | Synthetic adapters cannot close live integration gates |
| 5     | Make It Feel Natural | Physical/field qualification and polished accessibility     | All mandatory gates plus owner acceptance              |

Sextant owns camera capability/lifecycle; Watchglass owns the hand observation provider. Parallax, Crossdeck, Landfall and UI owners apply permitted actions. Storytide interprets narrative outcomes and One Voyage alone advances progression. Conventional controls remain essential equivalents.

Phase 1's foundation preview is integrated; physical and owner acceptance remain open until qualified trials are available. Each phase uses focused tests before an ordinary Sounding Line final check and protected-main merge. Phase records are written from actual work and evidence. Phase 2 has not begun.
