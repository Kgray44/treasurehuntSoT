---
title: Reach fused fingertip tracking and pipeline audit
audience: product-engineering
status: development-validation-in-progress
canonical_for: reach-fused-fingertip-pipeline-audit-20261018
last_reviewed: 2026-10-18
---

# Reach fused fingertip tracking and pipeline audit

The owner reported repeated relative setup resets between targets 1 and 2 and less precise fingertip movement in good light. This successor repairs the existing development preview in [PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769). It preserves the accepted camera/model/rendering implementation and the historical [comparison with main](Changes_From_Main_20261017.md). It is development work, with no protected qualification, mainline integration or physical acceptance claim.

## Reproduced causes

The target controller does not reset its source when it saves a target. Its 700 ms transition continues tracking. The earlier optical producer, however, expired its identity after 1,200 ms without an accepted appearance match. A subsequent automatic model seed created a new optical generation; after readiness settled that generation, the controller correctly rejected transferring existing samples to it. A source-bound controller regression reproduces the owner's exact warning with a constant camera and fresh packets. This establishes a reachable cause, not unique attribution to an unrecorded physical trial. Explicit manual selection has a separate rule: expiration reserves the owner's intent and requests selection again, rather than borrowing a model tip.

The earlier image matcher returned integer analysis-grid centers. A private analytic diagnostic accepted forty successive 0.1-pixel translations but held the same output on 34 updates; P95 error was 0.65 analysis pixels. At the maximum 320-pixel analysis width this is roughly 1.3 pixels in a 640-pixel camera image. With the minimum admitted 0.08 relative span, a whole analysis-pixel step can represent about 3.13% of the pointing area's width. These are controlled correspondence measurements, not physical accuracy.

## Pipeline walkthrough

| Stage                     | Responsibility and retained boundary                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sextant capture           | Own the authorized camera lease and actual capabilities. Ordinary RGB capture remains sufficient; native IR/depth assistance requires an implemented compatible provider.                                                                                                                                      |
| Presented frames          | Process new presented images with one inference in flight. The new guard checks available presentation/capture origin age before extraction, after extraction and when results return, separately from the worker dispatch clock. Old pixels cannot acquire a fresh identity merely by being dispatched later. |
| Hand inference            | Preserve the pinned model weights, fresh full-image search, bounded actual neural regions and GPU/CPU startup behavior. No saved landmarks are returned as fresh inference.                                                                                                                                    |
| Watchglass interpretation | Require observed, anatomically conditioned full-hand index evidence for model-assisted coordinates. Handedness confidence is not position confidence or identity. Cropped index interpretation remains separate from full-hand authority.                                                                      |
| Relative producer         | Combine verified full-hand anatomical position with supported image continuity under one versioned producer and one fingertip identity. Appearance-reference renewal is distinct from replacing the selected finger. Contrary, ambiguous, conflicting or unverified sources pause output.                      |
| Readiness                 | Accumulate fresh evidence and recover the same producer. A modality change alone is not a source change. A real new finger, camera or incompatible producer still requires fresh setup.                                                                                                                        |
| Collection                | Keep completed targets through temporary pauses. Only fresh eligible samples count; interruption time never contributes evidence. Unfinished hold recovery remains bounded to 2.5 seconds.                                                                                                                     |
| Independent check         | Keep five held-out targets, at least fifteen samples and 600 ms evidence per hold, and raw P95 error no greater than 3% of the plane diagonal. Smoothing cannot make a failed raw check pass.                                                                                                                  |
| Rendering and cleanup     | Preserve the hand overlay and display-only smoothing. Hidden pages stop owned capture; an explicitly labelled last-seen marker is never fresh evidence.                                                                                                                                                        |

The capture audit also reproduced a limitation of browsers without presented-frame callbacks: the existing playback counter difference can stall when total and dropped counts advance together. Replacing it with total count would also count frames dropped before decoding, so this audit retains conservative behavior and records the limitation. It is not evidence that the owner's RGB or IR sensor has a fixed 1.1 Hz cadence.

## Versioning and recovery

The relative feature and association labels become `INDEX_TIP_FUSED_V1` and `INDEX_FUSED_TRACK_V1`. The vector remains `[1, tip.x, tip.y, 0, 0]`, with a new producer algorithm digest. Former image-only profiles cannot be silently reused at collection, fitting, validation or estimation boundaries. Absolute calibration continues to use its existing model-axis profile.

Short interruptions retain completed targets and explain that collection is paused. An actual new producer identity has a specific explanation that old samples cannot transfer to an unverified finger. Camera binding changes have their own reason. The repair does not merely hide the reset or change the warning.

## Verification and remaining physical limits

Focused test and live-browser results will be added after the source is frozen. Private owner media and landmark coordinates remain local and are excluded from commits. Continuous recorded-hand diagnostics must retain transitions rather than resetting a tracker at each prompt. Prompt labels describe requested poses and do not prove anatomy or pointing correctness.

No monocular system can guarantee a correct finger under complete occlusion, indistinguishable imagery, arbitrary blur, an unobserved replacement or failed neural acquisition. Recovery must pause honestly in those cases. A fresh owner webcam trial is required after the updated preview is installed; deterministic images, recordings and browser fixtures do not close that physical gate.
