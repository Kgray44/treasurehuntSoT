---
title: Reach Phase 1 perception continuation and comparative benchmark
audience: product-engineering
status: development-investigation-with-unresolved-physical-reliability
canonical_for: reach-phase1-perception-continuation-20261019
last_reviewed: 2026-10-19
---

# Reach Phase 1 perception continuation

This continuation of [PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769) retains the previously validated application after two distinct experiments fail to establish a safe tracking gain. **NO_VERIFIED_PERCEPTION_IMPROVEMENT; PHASE_1_NOT_READY.** The fingertip perception mission remains incomplete. A reproducible comparison runner is added; no experimental recovery method, neural weight or production tracking change is adopted.

The starting branch is `a127c6c96cf23ca1c3c796b43eeeb01ba1953dda`; its application bytes equal `2d03e6678c7af0d08775c67ea9afffa79e2f9ac2`. This iteration preserves the [overnight negative result](Overnight_Reliability_Campaign_20261019.md), original failed mixed-motion assertion, all 1,336 cached packets, grayscale planes, recordings and private failed research receipts. [Scope and invariants](../../../.agents/reach-phase1-perception-20261019.md) remain Phase 1 only. There is no protected merge, qualification or physical acceptance claim.

## Pipeline causes and evidence limits

| Stage                              | Finding and ownership                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Camera delivery and timing         | Sextant owns permission, lease and geometry. `browser-runtime.ts` uses presented-frame identity, one inference in flight, shared immutable bitmap/gray pixels and final 150 ms gates. All retained RIGHT packets are fresh; camera delivery is not its first observed failure. The earlier idle-tab zero-observation startup is a separate unresolved cause. |
| Neural detection                   | The pinned Watchglass provider scans global palms and may retain two recent genuine inference regions. Cached observations establish a returned hand, not internal palm-detector confidence. The new cache ablation below tests one cause directly.                                                                                                          |
| Landmarks, index and anatomy       | `hand-provider.ts`, `hand-detection-authority.ts` and index geometry distinguish observed anatomy, full pointing and registered partial index. Handedness score is not hand-presence or tracking confidence. Hand presence and plausible four-joint geometry cannot independently prove the selected digit.                                                  |
| Appearance and coordinate accuracy | `index-image-tracker.ts` uses translation NCC on stable/adaptive material, unique peaks, structure, bounded search, rival negatives and actual reverse closure. Model/image agreement is a consistency test between correlated sources, not independent ground truth.                                                                                        |
| Temporal association and recovery  | `index-source-association.ts` and `temporal-index-track.ts` separate logical identity from coordinate permission. A new source needs old distinct tip material, separated index regions including DIP, coherent geometry and current probation. Search prediction cannot publish coordinates or renew trusted evidence.                                      |
| Readiness, samples and display     | `index-image-readiness.ts`, `sample-window.ts` and the Laboratory require fresh qualified producer measurements. Completed calibration targets may remain suspended while unusable; retained progress does not repair missing perception. Display coasting and matched feedback do not count as samples.                                                     |

RIGHT first loses coordinate qualification at source frame 466, 25.795 seconds: stable/adaptive material agree while the neural endpoint differs by about fifteen analysis pixels. Coordinate-conflict handling revokes measurement permission. Subsequent correspondence failures prevent safe reproof. A separate agent inspected native-only frames 465–467 without model overlays: the terminal surface is visible at 466 and becomes blurred at 467. This is coarse AI development review, not independently human-labelled endpoint accuracy.

BOTTOM-RIGHT first loses appearance at frame 772, 42.729 seconds; one full-model rescue at 774 does not continue at 775. The established appearance expires at 44.079 seconds. Native-only independent review sees a terminal region at 772, followed by substantial blur/overlap at 774–776, where a unique endpoint cannot defensibly be labelled. Longer preservation timers cannot create missing selected-index evidence.

The broad mixed-motion browser failure remains separate: changing/ambiguous model sources and movement outside the trusted search windows eventually break identity continuity. The saved recording's SWEEP prompt is not continuous anatomical motion ground truth. No raw synthetic raster is silently equated to an analytic reconstruction or a model overlay.

## Reproducible baseline

`scripts/reach/phase1-benchmark.mjs` accepts explicit hash-pinned private inputs and frozen baseline/candidate modules. It validates the complete result stream, each grayscale slice, source/context binding, chronology and denominator before execution. Each arm receives its own pixels and raw packet copy; arm order alternates. No prompt reset, camera, inference, database or shared service is used. Entry and imported dependency pins are checked before and after the run. Existing/failed output directories are never overwritten.

The runner reports fresh measured positions separately from readiness, missingness, logical ID changes, observed availability-return intervals, reference-region errors and local interpretation CPU cost. A reference attestation cannot become certified ground truth. Known stale pixel origins must not be relabelled as new captures. Serial recording frames do not justify independent-frame confidence intervals.

The retained baseline reproduces 504 measured positions and 416 readiness frames from 1,336 packets, with seven logical ID changes and 832 missing/unusable positions. Those logical changes do not prove seven anatomical digit switches.

| Prompt category | Packets | Retained measured positions | Retained missing/unusable |
| --------------- | ------: | --------------------------: | ------------------------: |
| LEFT            |      90 |                          87 |                         3 |
| RIGHT           |      89 |                          13 |                        76 |
| BOTTOM-RIGHT    |      71 |                          13 |                        58 |
| SWEEP           |     180 |                          11 |                       169 |
| All categories  |   1,336 |                         504 |                       832 |

All prompt categories remain in the machine-readable comparison. Prompt names are instructions, not verified gestures. The 40 V3 sparse references include thirty visible pointing estimates, six ambiguous and two not-visible tips. They are nonblinded AI development estimates, include disclosed post-metric corrections, and have no independent physical ground-truth authority. The previous metadata-only public-video reservation still lacks verified asset-specific rights/provenance and is not used as a physical holdout.

The [baseline reproduction](evidence/perception-continuation-20261019/baseline-reproduction.json) compares the frozen historical module with a newly built current-source module: all 1,336 output, readiness and admission rows match exactly. Both report 12/30 sparse visible-reference positions: nine inside annotation uncertainty regions, three outside and eighteen missing. These estimated regions do not establish anatomical false-digit rates. Zero positions occur on three explicit negative controls. [Similarity comparison](evidence/perception-continuation-20261019/similarity-comparison.json) preserves the same exact baseline parity and all fourteen scenario denominators.

Build a standalone module from each reviewed source tree with the locked local tool; write the bundle and metafile to new private paths:

```text
node node_modules/esbuild/bin/esbuild scripts/reach/phase1-benchmark-entry.ts --bundle --platform=node --format=cjs --target=es2022 --tsconfig=tsconfig.json --outfile=<NEW_PRIVATE_BUNDLE.cjs> --metafile=<NEW_PRIVATE_META.json>
```

Run the same-input comparison with explicit paths and SHA-256 pins. Angle-bracket values below are placeholders, not literal shell syntax. Preserve the private invocation alongside its output; do not publish media, label coordinates or private paths.

```text
node scripts/reach/phase1-benchmark.mjs --results <RESULTS.ndjson> --gray <GRAY.bin> --receipt <RECEIPT.json> --receipt-sha256 <SHA256> --expected-frames 1336 --gray-width 320 --gray-height 240 --baseline <BASELINE.cjs> --baseline-sha256 <SHA256> --candidate <CANDIDATE.cjs> --candidate-sha256 <SHA256> --expected-baseline-results <PRIOR_RESULTS.ndjson> --expected-baseline-sha256 <SHA256> --output <NEW_PRIVATE_DIRECTORY>
node --test tests/reach/phase1-benchmark.test.mjs
```

Reviewed labels are optional through `--labels`/`--labels-sha256`. Imported synchronous module closures require `--dependencies`/`--dependencies-sha256` with a JSON `files` array of `{path, sha256}` entries relative to the manifest directory; standalone bundles require no external experiment dependency. All executable code remains trusted reviewed code, not a sandbox. The [source manifest](evidence/perception-continuation-20261019/source-manifest.json) binds ninety source/configuration/dependency files, the final runner and comparison artifacts. It retains the earlier private freeze's digest and records a subsequent local-variable naming correction required by repository lint. Both comparisons were rerun after that correction; original source/result pins remain in the safe comparison.

## Candidate 1: anatomy-proposed similarity registration

A private frozen candidate proposes rotation/uniform scale from previously verified and current index anatomy, transports material coordinates, requires current tip/DIP/another separated region, unchanged uniqueness and reverse checks, and three captures/120 ms before transactionally attempting the unchanged producer. It does not clear model conflicts or authorize a new source from geometry alone. This differs from the previous translation, gradient, multiscale, crop and LK negatives.

The development positive control exercises an actual current-image commit. Blank, missing-DIP, rival and foreign-source development controls make none. These are mechanism controls, not independent tracking gains.

An independent agent froze thirteen analytic scenarios before seeing the frozen candidate: 208 frames including 52 acquisition seeds and 156 evaluation frames. Rotation/scale positives have a full valid model and are a baseline ceiling. All 208 candidate output rows equal the paired baseline; the 72 transform evaluation frames already have positions. Twenty-three eligible research probes produce zero proposals, probation frames or commits. This holdout therefore demonstrates no new recovery.

Independent review found a material safety regression: research probation advances before the core final freshness rejection. A separate frozen-candidate probe presents two rotations completing 151 ms late; both core calls reject, but research probation advances. A later fresh frame then commits after counting those rejected captures. **REJECTED_UNQUALIFIED.** No post-holdout repair or threshold tuning is adopted, and all failed variants remain private.

The [candidate rejection](evidence/perception-continuation-20261019/similarity-rejection.json), [independent held-out aggregates](evidence/perception-continuation-20261019/independent-analytic-holdout.json) and [independent stale-probation counterexample](evidence/perception-continuation-20261019/independent-stale-probation-rejection.json) preserve the decision. On the recorded corpus, 22 eligible research probes make zero proposals/commits: all positions, readiness and logical changes remain 504/416/7. In the final paired runner, interpretation median/P95 is 0.9544/2.2151 ms for baseline and 0.9963/2.3662 ms for candidate; totals are 1,364.29/1,447.70 ms. Preceding private paired runs have different timings under different machine load and are retained separately, not pooled. These runs do not charge counterfactual compute against the original cached completion clocks; their timings cannot prove live freshness or latency.

The analytic blank control also injects a deliberately false, structurally valid full POINT model. Both baseline and candidate can output MODEL coordinates on those blank pixels. This is a hypothetical trusted-model failure injection, not an observed false-positive rate of the pinned neural model; the candidate adds no independent protection. Existing genuine blank neural controls must not be replaced by this assumption.

## Candidate 2: retained neural ROI cache ablation

Two actual pinned GPU providers process all 1,336 chronological native images. Each pair receives bit-identical decoded unmirrored 640×480 canvas pixels, model weights, graph and thresholds. The only algorithm difference is resetting the recent-region cache before every frame. Pair order alternates. Original capture deltas drive cache time; worker inference duration is measured independently. The input is saved re-encoded camera imagery, not a fresh sensor trial or exact equality with the older video decode.

| Metric                                                 | Retained regions | Reset every frame |
| ------------------------------------------------------ | ---------------: | ----------------: |
| Raw first-hand index outputs / 1,336                   |            1,233 |             1,163 |
| Raw in-frame first-hand index outputs / 1,336          |            1,201 |             1,142 |
| RIGHT raw outputs / 89                                 |               89 |                87 |
| BOTTOM-RIGHT raw outputs / 71                          |               30 |                28 |
| SWEEP raw outputs / 180                                |              172 |               157 |
| Visible development references with finite output / 30 |               29 |                28 |
| Inside development uncertainty circles / 30            |               20 |                20 |
| GPU inference median / P95 ms                          |     8.73 / 14.58 |      8.43 / 13.59 |

Every one of the 1,163 paired first-index endpoints is exactly equal, including frame 466. All 28 paired finite sparse-reference errors are equal. Resetting the cache does not remove that RIGHT endpoint displacement under these inputs; it removes some outputs. A conditional median error can look lower merely because a missing prediction leaves its denominator, so it is not an accuracy gain. Twenty retained-region frames return multiple hands versus zero reset frames; without reviewed multi-hand truth, this is neither a measured false-identity reduction nor a correctness claim.

**REJECTED_NO_LOCALIZATION_GAIN_WITH_AVAILABILITY_REGRESSION.** The small single-run inference-cost difference does not compensate for lost output or establish runtime latency. An independent source/receipt reviewer agrees with this causal conclusion. No model, license or production dependency changes occur. Owned browser creation, descendant exit and control-port release are recorded; cleanup passes, and pinned application assets remain unchanged.

The [paired ROI ablation](evidence/perception-continuation-20261019/roi-prior-ablation.json) retains every category and label denominator. The [native failure review](evidence/perception-continuation-20261019/independent-native-failure-review.json) retains only safe coarse findings and image hashes; all image pixels stay private. Independent recomputation confirms all twenty-one first-hand landmarks, not only the index endpoint, are exactly equal on the 1,163 paired outputs.

## Validation, readiness and next evidence

Fresh subsystem regressions pass 1,588/1,588 tests in 87 Reach/Watchglass/Sextant files with zero pending tests. An earlier focused pass is 222/222 in nine files; these overlapping counts are not added together. The comparative runner separately passes six contract tests for tampered inputs, reference provenance, stale/predicted measurement exclusion, module isolation and output preservation. Full TypeScript and scoped lint pass. Existing assertions remain intact.

The current production application is unchanged. Earlier 16/16 Laboratory browser, 11/12 index-browser and controller journeys retain their original provenance; they do not become new physical acceptance. Two current production builds complete with passing owned-process cleanup. The first canonical preparation refuses reuse with `DEVELOPMENT_SOURCE_CHANGED_DURING_PREPARE` because benchmark source changed while it built. The frozen preparation passes its source check but refuses sealing with `DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES`: Turbopack emits three absolute Windows junctions to this worktree's own `pino`, `sharp` and Prisma dependencies. Both refusals remain failures; shared acceptance code is unchanged.

A separately labelled supplemental diagnostic copies that generated build only after independently allowlisting all three dependency targets. It uses fresh synthetic database clones, new ports and supervised processes, with source/fixture stability, process-tree cleanup and port release verified. The original broad mixed-motion case fails its unchanged one-index assertion with generations 1, 2 and 3; later assertions do not execute. The Laboratory Chromium cohort is **8/10**, zero skipped: both photographic actual-worker cases fail initial readiness before later motion/calibration assertions. No passing historical cohort is substituted for these failures. These functional diagnostics do not override canonical admission or qualify a release.

A bounded private copy of the first photographic case keeps its original assertion and adds passive worker/presentation clock listeners. It receives one READY and 92 RESULT packets from 93 FRAME dispatches; all 92 results contain a hand. FRAME capture clocks are page-relative, while worker inference/reception clocks are epoch-based. After normalizing those clock domains from paired dispatch timestamps, every result exceeds 150 ms: arrival age minimum/median/P95/maximum is **263.6/287.2/349.6/351.5 ms**. Presentation-origin age at callback is median 13.6/P95 17.1 ms, with no invalid or future origins. An independent reviewer recomputes the same result using each matching dispatch clock; latest presented-origin age at dispatch remains at most 76.9 ms. This exercised failure is late processing rather than zero raw neural output; safe rejection leaves the image tracker unseeded and admits zero observations. The earlier two photographic failures lack equivalent raw clocks, so this does not retroactively establish each failure's timing cause. Worker compute versus scheduling, the earlier idle-tab failure and physical camera/display latency remain unqualified. `GPU_WEBGL` does not identify a physical GPU or prove software rendering. An initial mixed-clock arithmetic derivation and an earlier no-tests-found diagnostic attempt are retained privately as invalid/failed evidence, not counted as tests or timing results.

The [check dispositions](evidence/perception-continuation-20261019/checks.json) and [passive clock aggregate](evidence/perception-continuation-20261019/photographic-clock-diagnostic.json) preserve those boundaries. Crossdeck, shared acceptance machinery and the owner's preview remain unchanged.

Unavailable measurements remain explicit: dense correct-digit rate and false identities, independently reviewed physical coordinate error, anatomical identity switches, actual natural-motion recovery success/delay, stationary jitter, live capture/model/display throughput, sensor-to-visible latency and complete physical calibration. Cached interpretation timings exclude inference/rendering; GPU ablation timings exclude camera ingress and display. Live CPU/GPU fallback and target-responsive natural calibration are not repeated; passing software contracts and historical journeys do not establish those live outcomes. No production-performance improvement or CPU/GPU fallback improvement is claimed.

The next productive perception experiment must provide new independent current-image evidence when the index endpoint and model disagree or blur destroys material detail, with exercised same-index versus other-digit recovery. A larger compatibility radius, model-only plausible anatomy or longer sample preservation would not provide that proof. A separately recorded post-freeze target-responsive physical sequence with reviewed identity/endpoint uncertainty is still needed to assess RIGHT, lower edge and natural transitions. No owner-media upload, new camera recording or Phase 2 is performed.

Phase 1 remains a foundation preview with unresolved physical reliability. This finite iteration delivers reproducibility and two defensible rejections; it does not complete the owner's perception mission.
