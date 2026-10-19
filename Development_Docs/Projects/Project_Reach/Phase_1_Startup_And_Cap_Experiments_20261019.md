---
title: Reach Phase 1 backend latency and terminal-cap experiments
audience: product-engineering
status: development-investigation-candidates-unqualified
canonical_for: reach-phase1-startup-cap-experiments-20261019
last_reviewed: 2026-10-19
---

# Reach Phase 1 backend latency and terminal-cap experiments

This continuation of [draft PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769) finds a reproducible backend latency failure and a promising **private startup candidate**, but does not establish safe physical RIGHT and mixed-motion improvement. A distinct image-terminal detector is rejected as a recovery method. **PHASE_1_NOT_READY; PERCEPTION_MISSION_INCOMPLETE.** No production tracking, model, dependency, calibration or acceptance machinery changes are adopted by this report.

The starting source is `0aca4bd1cbbac51992e03090dff279b8f1cf9b20`. Application bytes still equal `2d03e6678c7af0d08775c67ea9afffa79e2f9ac2`. The [preceding benchmark and negative experiments](Phase_1_Perception_Continuation_20261019.md), all original recordings and failed receipts remain intact. The original 1,336-frame baseline remains 504 measured positions, 416 ready frames, RIGHT 13/89, BOTTOM-RIGHT 13/71 and SWEEP 11/180. Later comparisons below use newly decoded paired inputs and must not replace those original counts.

## Backend latency cause and comparison

The current runtime starts the optional recovery worker on GPU. Its READY confirms initialization and synthetic network warmup; it does not certify timely real-image completion. Existing fallback handles initialization failure or startup timeout. An established generation cannot silently switch backend or provider policy. The runtime correctly rejects results older than 150 ms, including the earliest known image origin.

Three fresh Chromium photographic journeys retain all 180 assertion call signatures from the private diagnostic copy of the original Laboratory specification. The GPU arm is byte-identical to that previous copy. The original-CPU arm deliberately routes only optional-worker initialization to an error, causing the unmodified application to start its actual original CPU worker. The CPU-ROI arm overrides the INIT delegate request to CPU; its actual recovery provider, weights and graph remain unchanged. These CPU interventions are experimental inputs, not passive-only instrumentation or normal production selection.

| Actual worker arm        | Journey                          | Actual results | Arrival median / P95 ms | Results over 150 ms |
| ------------------------ | -------------------------------- | -------------: | ----------------------: | ------------------: |
| GPU, actual ROI provider | Fails initial readiness          |             82 |           331.3 / 345.7 |               82/82 |
| CPU, original provider   | Passes complete selected journey |             56 |             32.5 / 46.3 |                0/56 |
| CPU, actual ROI provider | Passes complete selected journey |             60 |             33.2 / 47.4 |                0/60 |

An independent reviewer matches every RESULT to its exact FRAME dispatch and normalizes the page-relative capture against paired dispatch epoch clocks. Image-presentation-origin arrival ages also exceed 150 ms for all 82 GPU results and none of the CPU results. All arms have one inference in flight. GPU returns one hand on every result, so this exercised failure is late completion rather than absent neural output. Median return transport is about 0.2 ms; the much larger completion interval includes worker scheduling, bitmap upload, synchronous graph execution, GPU waiting and decoding. It is not isolated neural compute or sensor-to-display latency.

These are separate journeys, not synchronized pixel-paired trials. GPU never reaches the later partial-occlusion and two-hand stages; both CPU arms do, then stop their camera/workers. Their different achieved stages and observation denominators are retained. Generic WebGL metadata does not identify a physical GPU or prove software rendering. [Independent clock and assertion review](evidence/startup-cap-20261019/independent-runtime-clocks.json) records the exact exposure, timing, cleanup and limitations.

Canonical sealing still refuses `DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES` for three absolute Windows dependency junctions in the owned build. These runs use the previously verified supplemental build copy, fresh synthetic database clones, unique ports and supervised processes. Every run verifies source/fixture stability, descendant cleanup and port release. They do not override that refusal or provide protected qualification. The owner's preview and shared runtime state remain untouched.

## Frozen startup candidate

A private provider/worker pair adds two fixed 640×480 gray probes before READY. Each forces global palm inference plus two spatially distinct landmark regions. Startup timestamps are ordered -3 for warmup, then -2 and -1 for the two probes. Both complete within the unchanged 150 ms necessary bound or the actual-ROI backend fails this screen. The first native-size probe is counted; no extra compilation outlier is discarded. All synthetic outputs and retained regions are cleared.

When GPU fails, the candidate closes it and tries the same actual-ROI provider once on CPU. Close failure is fatal. Provider/backend metadata identify the actual selected path; established live generations never change backend. The original parent retains its 12-second optional and 15-second total startup deadlines. The unmodified parent may still start legacy ORIGINAL_CPU after an initialization ERROR, so this is not an application-wide ban on an unscreened legacy fallback. A passing synthetic capacity screen does not qualify live pixels, other frame sizes or runtime under later load.

The frozen candidate's first private Chromium journey passes the unchanged selected photographic assertions. Its GPU probes take 268.4 and 274.1 ms and fail; CPU probes take 35.8 and 34.3 ms and pass. READY truthfully identifies CPU_WASM / WATCHGLASS_ACTUAL_ROI_RECOVERY_V1 with `GPU_STARTUP_LATENCY_HEALTH_FAILED`. All 55 real-image results arrive within 150 ms, median 33.7/P95 52.6 ms; presentation-origin arrival age reaches at most 109.8 ms. One worker initializes in approximately 3,036.8 ms from INIT dispatch to READY, without a parent legacy fallback. This interval excludes the slightly earlier model-start setup; the unchanged parent deadline checks also accept READY. This tests an automatic startup decision rather than a forced CPU request. Seventeen private development contract checks and two syntax checks pass; these are additional research controls, not repository acceptance or physical proof. An initial development mock failure is retained separately. The [freeze record](evidence/startup-cap-20261019/startup-candidate-freeze.json) predates the [independent source, assertion and clock review](evidence/startup-cap-20261019/independent-startup-candidate.json); its then-pending runtime field remains historical. Tiny negative transport samples reflect clock precision and are not negative latency claims.

This candidate remains private and unpromoted. Its fixed-size screen and the backend-dependent localization/identity outcomes below require further work before a production decision. No source flag, model weight or persistent user preference is added to the application.

## Same-input neural backend comparison

Two pinned actual-ROI providers process all 1,336 native camera images in chronological order, one on GPU and one on CPU. Both receive bit-identical unmirrored 640×480 canvas pixels, the same original capture deltas, weights, thresholds and ordinary retained-region policy. Arm order alternates. New exact paired 320×240 grayscale planes are retained. This uses an owned Edge browser, distinct from the Chromium application latency experiment.

| Raw neural metric                                   |          GPU |           CPU |
| --------------------------------------------------- | -----------: | ------------: |
| First-hand outputs / 1,336                          |        1,233 |         1,226 |
| Multiple-hand outputs / 1,336                       |           20 |            24 |
| Inference median / P95 ms                           | 7.56 / 11.51 | 32.34 / 46.62 |
| Finite outputs on 30 visible development references |           29 |            29 |
| Inside those uncertainty regions / 30               |           20 |            21 |
| Maximum raw reference-center error, native pixels   |        41.40 |        100.73 |

The 1,211 paired finite first endpoints differ by median 3.01/P95 40.42 native pixels. They are not numerically equivalent. On 28 paired finite sparse references, CPU is closer to the estimated center on 17 and farther on 11; three enter and two leave uncertainty regions. The large CPU error at BOTTOM-RIGHT frame 823 is retained. Raw first-hand output is not selected-index authority; missingness, ambiguity and selection remain separate. [Paired inference aggregates](evidence/startup-cap-20261019/paired-backend-inference.json) retain all prompt categories and denominators.

The unchanged canonical interpreter separately consumes each arm's new neural outputs and exact paired grayscale. This **counterfactual interpretation keeps the old capture/completion clocks** to isolate source/material behavior. It does not charge the alternative inference cost against those clocks and cannot establish live freshness or throughput.

| Conditional interpreter metric          | Native-input GPU | Native-input CPU |
| --------------------------------------- | ---------------: | ---------------: |
| Measured positions / 1,336              |              428 |              504 |
| Ready frames / 1,336                    |              364 |              446 |
| Logical ID changes                      |                6 |                9 |
| RIGHT positions / 89                    |               13 |               64 |
| BOTTOM-RIGHT positions / 71             |               14 |               13 |
| SWEEP positions / 180                   |                0 |               26 |
| Positions on 30 old visible references  |               11 |                9 |
| Inside old uncertainty regions / 30     |                9 |                8 |
| Outputs on three old explicit negatives |                0 |                0 |

These new native-input GPU counts differ from the original video-worker baseline. The original 504/416/7 baseline is preserved; the CPU total of 504 is a coincidence across different input cohorts. RIGHT and SWEEP availability gains are promising, but BOTTOM-RIGHT and old sparse-reference availability regress and logical replacements increase. Logical replacements do not prove anatomical switches; they also cannot be ignored as harmless. The previous broad mixed-motion browser identity assertion remains failed. [Conditional interpreter aggregates](evidence/startup-cap-20261019/paired-backend-counterfactual.json) are research evidence, not a verified improvement in correct selected-index tracking.

## Current-image terminal-cap experiment

The frozen detector searches paired bright-foreground shaft boundaries and terminal closure near current index anatomy. It supplies structural localization proposals only, preserving the raw neural endpoint, original eight-analysis-pixel model compatibility, two-pixel material reverse closure, selected-source/identity, freshness and sample gates. It never creates a source alias or coordinate authority.

On the exact native RIGHT failure frame 466, the detector finds a terminal proposal inside an independently sealed broad native-image region. Exact physical endpoint error is unavailable. The returned point remains 16.10 analysis pixels from the raw neural tip, outside the unchanged compatibility bound. Four other-digit chain proposals and three background/face/ceiling proposals abstain on this single development image. A known analytic development control localizes a visible terminal while the original tracker reports FULL_HAND_INDEX_CONFLICT; this does not authorize overriding that conflict. A duplicate-cap control also receives a structural proposal, exposing the missing uniqueness proof. [Development feasibility](evidence/startup-cap-20261019/cap-development-feasibility.json) records the limitation.

An independent evaluator seals new renderer code and a private seed before generating 96 sequences/2,304 frames for the frozen detector. All cases remain in the denominator. Sixty-two sequences establish a seed by the four planned acquisition frames. Seventeen positive episodes actually exercise missing baseline measurements; four mixed episodes are baseline ceilings and excluded from improvement claims. Within those 17 episodes, 271 fresh visible baseline-missing frames produce 128 structural proposals, with zero meeting the fixed 2.5-analysis-pixel synthetic cap-center target and zero authoritative recoveries.

The dominant approximately 8.51-pixel error reflects a fixed cap-center versus distal-contour convention mismatch. It fails the declared analytic target; it is not proof of a wrong physical digit. More consequentially, wrong-digit controls produce 160 rival structural proposals and copied-material controls produce 102 ambiguity-required proposals. A local terminal shape cannot establish selected-index semantics or whole-window uniqueness. No candidate measurement, calibration sample or source transition is committed. **REJECTED_AS_LOCALIZATION_OR_RECOVERY_AUTHORITY**, without post-evaluation tuning.

[Independent analytic results](evidence/startup-cap-20261019/cap-independent-analytic.json) and [endpoint/negative interpretation](evidence/startup-cap-20261019/cap-endpoint-interpretation.json) preserve source hashes, seed failures, ceiling cases, missing model proposals and category counts. The candidate's pre-half-pixel distance helper can disagree with distance recomputed from its returned point; evaluation uses the latter. Its synthetic foreign-context category changes a direct model semantic key, not an actual camera/provider observation envelope, and remains unqualified for camera-binding proof. Artificial valid POINT anchors on wrong pixels test the trusted-anchor contract; their baseline outputs are not an observed neural false-positive rate. All 120 stale analytic frames remain rejected by the original freshness gate. A first evaluator setup error is retained; only the harness was repaired before generating/evaluating sequences.

## Measurement, validation and readiness

All three consented local recordings are already development-exposed; one also contains a baked model overlay unsuitable for native-only accuracy review. There is no untouched physical recording. The 40 earlier sparse references and previous 208 analytic fixtures retain their development status. The 96 new analytic sequences are independent for the frozen cap experiment and become development data for any later method change.

Forty-eight additional native-image references are independently entered and sealed without viewing backend/model outputs or old reference values. All source-image hashes are verified. They contain 31 visible plausible-pointing estimates, four visible contrary open palms, two visible endpoints with unresolved gesture, six ambiguous regions and five nonvisible endpoints. One additional contrary open palm belongs to the ambiguous-region group; the final negative cohort includes all five explicit contrary postures. The earlier visible-only four-negative scoring remains private. The 37 visible point estimates have 10–15 native-pixel uncertainty. These remain AI development reannotations of an exposed recording, not a second human review, physical ground truth, dense anatomical identity labels or a true held-out camera trial.

| New sealed-reference metric                                       | GPU | CPU |
| ----------------------------------------------------------------- | --: | --: |
| Sole-hand raw in-frame outputs / 31 plausible pointing references |  24 |  28 |
| Raw outputs inside uncertainty circles / 31                       |  17 |  21 |
| Conditional interpreter outputs / 31                              |   6 |  12 |
| Conditional interpreter outputs inside circles / 31               |   6 |  12 |
| RIGHT conditional outputs inside circles / 11                     |   0 |   6 |
| BOTTOM-RIGHT conditional outputs inside circles / 9               |   0 |   0 |
| SWEEP conditional outputs inside circles / 5                      |   0 |   0 |
| Pointer outputs on five explicit contrary controls                |   0 |   0 |

All six new conditional positions are RIGHT references; no positive-reference position or circle hit is lost in this new set. The six common interpreter positions remain inside their regions, with error differences smaller than the annotation uncertainty. This supports a bounded RIGHT availability result, not improved exact accuracy or uninterrupted identity. It does not validate the unreviewed SWEEP output-count gain. Sole-hand raw scoring treats multiple-hand ambiguity as missing rather than choosing the hand closest to a reference. Ordinary anatomical index landmarks on open palms are not counted as false pointing actions.

Three paired raw errors improve and one BOTTOM-RIGHT raw error worsens beyond the fixed uncertainty intervals. That regression increases center error from approximately 28.58 to 131.40 native pixels; the unchanged interpreter produces no position there. Raw outputs on ambiguous references increase from five to six, while broad-region consistency changes from 5/5 to 4/6. Raw in-frame outputs on nonvisible references increase from one to two. Neither arm produces interpreter positions on these ambiguous or nonvisible references. BOTTOM-RIGHT remains unresolved even when more raw coordinates appear. [Sealed-reference scoring](evidence/startup-cap-20261019/native48-backend-review.json) preserves every reference category, missing denominator, conditional error and negative disposition. Sparse correlated stills do not establish anatomical identity-switch rates or natural-motion recovery success, and the higher full-stream logical replacement count remains unresolved. The independent disposition is partial conditional RIGHT improvement, with mixed-motion and physical acceptance unestablished.

The stronger-model review establishes no cleared production replacement. RTMPose Hand5 has an [official 21-joint release description](https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose#hand-2d-21-keypoints), but checkpoint-specific rights and actual browser runtime remain unresolved. [HaMeR installation](https://github.com/geopavlakos/hamer#installation) depends on separately licensed MANO assets; [MANO's license](https://mano.is.tue.mpg.de/license.html) does not grant general product use. No new checkpoint is downloaded or incorporated. Code licensing alone is insufficient evidence of weight/dependent-asset rights.

The retained application and existing assertions are unchanged. The preceding 1,588 subsystem passes retain their original source identity; all 90 source/dependency pins from the preceding manifest are rechecked unchanged. The six benchmark contract tests pass again for this publication. These checks are not fresh physical evidence. New private browser failures, successful CPU interventions, candidate checks and cleanup receipts remain separate. The [source manifest](evidence/startup-cap-20261019/source-manifest.json) binds preserved private research source, exact paired input/result streams and sealed references without exposing their contents. Documentation and Feature Catalog validation pass for this documentation-only publication; no completed capability or availability change is cataloged.

The next decision is whether the explicit startup capacity screen can be integrated with actual frame geometry and whether CPU's apparent recovery gains preserve the selected anatomical index on independently reviewed natural trajectories. Passing one photographic journey cannot answer either question. Dense same-index/rival labels, post-freeze RIGHT and mixed trajectories, actual controller/calibration success, stationary jitter and sensor-to-visible latency remain unavailable. No manual same-finger confirmation, new camera recording, Phase 2, Crossdeck change, protected merge or owner acceptance is performed.
