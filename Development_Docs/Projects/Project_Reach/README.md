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

The [detailed comparison with current main](Changes_From_Main_20261017.md) records specifications, unchanged accuracy gates, measurements and remaining limitations.

The [adaptive visual capture development record](../Project_Sextant/Adaptive_Visual_Capture_Design_20261017.md) assigns hardware access and local frame delivery to Sextant, image assessment to Watchglass, and tracking diagnosis/assistance trials to Reach. The current browser integration measures capture health and can trial a supported reversible exposure control on its existing camera. Regular-camera use needs no extra hardware. Native IR/depth delivery was privately probed but is not an installed browser assistance provider.

The latest [index finger continuity development preview](Index_Finger_Continuity_20261017.md) responds to continued lower-edge failures. It uses observed index geometry without requiring wrist or palm joints, plus a separately bound image-tip channel for relative control. Manual visible-tip hints can initialize an image track when the whole-hand model cannot. Same-track model/image transitions preserve source integrity; appearance uncertainty pauses and new anchors require fresh setup. Independent raw accuracy gates remain unchanged. This experimental local source still needs a new physical trial and protected integration.

The development candidate also adds a mandatory server-owned Reach policy and Admiralty reporting/control surface. Defaults are 15 Hz normal, 60 Hz active calibration, 8 Hz visible unfocused and 60 Hz model ceilings. Effective capture/model scheduling uses the lower applicable ceilings and one frame in flight. Availability, bounded rates, automatic numeric reporting/retention and the local-recorder ceiling are global controls. Camera permission and local diagnostic recording still require their existing explicit actions. Numeric reports contain bounded counters and fixed histograms rather than frames, landmarks, positions, calibration coefficients or account/client identifiers. Report windows cannot establish unique people or sessions. The [policy and reporting specifications](Changes_From_Main_20261017.md#mandatory-global-policy-and-automatic-numeric-reporting) distinguish client-reported metrics from controlled experiments and preserve pending integrated proof.

The [actual CPU-model rate experiment](evidence/index-continuity-20261017/actual-model-rate-latency-summary.json) retained all 1,292 results across two interleaved 5–30 Hz rounds under the existing gaming load. It observed 128 packets beyond the unchanged 150 ms limit. Nominal caps of 10–30 Hz produced roughly 8.4–9.5 actual captures/second; 72 step-position responses resolved, with one two-result confirmation unresolved. These public-photo direct-bitmap measurements exclude camera ingress, optical tracking, the full application and physical display timing.

The [natural pointing and recovery record](Natural_Pointing_Recovery_20261017.md) preserves earlier source, owner feedback and evidence. The complete lower-target recording review found visible fingers during missing and mislabelled whole-hand model results. Saved-video replay is diagnostic, not fresh physical reliability or owner acceptance; the owner excluded the unperformed sweep from motion claims.

The explicit local recorder at `/devices/reach/record` requires `REACH_LOCAL_POSE_CAPTURE=1` and a loopback Host. Its separately started 74-second guide records nine distinct pointing holds, relaxed pointing, a sweep, open palm, brief hiding and recovery without fitting calibration. Video defaults to a camera region without baked hand landmarks, with synchronized prompts below the image and a separate raw landmark trace. The live preview retains its existing overlay; the older overlaid recording remains selectable before recording. Both video modes are mirrored and re-encoded, with no audio, upload, account persistence or inclusion in ordinary aggregate exports. Keep recordings local and outside automatic repository commits. Prompt labels are instructions, not verified intent or ground-truth pointing accuracy. The standard laboratory remains video-free; the [guide](../../../docs/user/hand-laboratory.md#explicit-local-diagnostic-recording) distinguishes the opt-in exception.

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
