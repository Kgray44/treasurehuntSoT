---
title: Project Reach engineering home
audience: product-engineering
status: integrated-foundation-preview
canonical_for: project-reach-engineering-home
last_reviewed: 2026-10-11
---

# Project Reach engineering home

Reach is Voyagewright's reusable browser-first spatial interaction and intent system. Phase 1's browser hand laboratory, observation/coordinate foundation and independent calibration workflow are integrated as a foundation preview through [PR #697](https://github.com/Kgray44/treasurehuntSoT/pull/697), main commit `7284b0dfaa31037d074d27df0f27b968f3977000`, after the [required Mainline Decision](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38113725340) passed. Landed source/asset verification passed. Physical webcam and held-out calibration, accuracy, jitter, exposure-to-visible latency, ergonomics and owner acceptance remain open; full Phase 1 is not accepted. See the [implementation and validation record](Project_Reach_Phase_1_Implementation_and_Validation_Record.md). Later-phase target acquisition, selection, manipulation and owner integrations are not implemented by this phase.

## Effective governing sources

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
