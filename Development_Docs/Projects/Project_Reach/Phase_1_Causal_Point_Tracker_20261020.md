---
title: Reach Phase 1 causal point tracker feasibility
audience: product-engineering
status: rejected-fixed-route-perception-mission-incomplete
canonical_for: reach-phase1-causal-point-tracker-20261020
last_reviewed: 2026-10-20
---

# Reach Phase 1 causal point tracker feasibility

**FIXED OFFLINE ROUTE REJECTED; PHASE 1 NOT READY.** A licensed learned causal point tracker supplies only 6/25 raw predictions inside the fixed post-reference positive development circles, compared with 12/25 for the original cached neural output. RIGHT falls from 9/11 to 3/11; none of the new RIGHT reference predictions passes the model's own visibility test. Every one of 874 native inference calls exceeds 150 ms. No production tracking candidate is nominated or promoted. The owner's perception mission remains incomplete.

Production, tests and tooling remain byte-equal to retained source 62ebde00a7dd9c623a20b46e20d6f4e9d63dfe99 on existing draft [PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769). The [complete image diagnostic](Phase_1_Complete_Image_Diagnostic_20261019.md) retains the admitted application baseline of 504/1,336 positions, RIGHT 13/89 and the separate mixed-motion failure. This experiment creates no application positions and performs no candidate application replay. Raw proposal counts are not compared with accepted positions as a tracking gain.

The [full sequence aggregate](evidence/causal-point-tracker-20261020/sequence-aggregate.json) and [native48 aggregate](evidence/causal-point-tracker-20261020/native48-aggregate.json) retain every category and declared denominator. They contain no images, coordinates, per-frame identifiers, source identity strings or private paths. Raw trajectories, logits, seeds, annotations, command bindings and failed preparation records remain private and immutable.

## Hypothesis, rights and fixed route

This hypothesis tests learned query-to-current-image correspondence with causal temporal refinement. It is distinct from the earlier [fixed descriptor query experiment](Phase_1_Descriptor_Feasibility_20261020.md), sparse Lucas-Kanade tracking, normalized-correlation material matching and the [reflection experiment](Phase_1_Reflection_Inference_20261020.md). A bounded relevant-source audit found no previous use of this model family; it does not establish absence from all repository history.

The checkpoint is Google causal BootsTAPIR, 218,887,028 bytes, SHA-256 87c1e752cf5ce56e3e2f7da460aeb4d40fc826d04ef2939bade86a5c7495377f. The pinned [official TAPNet README](https://github.com/google-deepmind/tapnet/blob/730cda1c730877cfedbe01bf87fb1cadb78a565d/README.md#license-and-disclaimer) and [Google model card](https://huggingface.co/google/tapnet/blob/52501fe93ba6f1a7e3b685b776cc6aef51aa33cd/README.md) explicitly apply Apache 2.0 to the released pretrained checkpoints. The causal filename, exact downloaded bytes and expected SHA are checked; similarly named offline or newer checkpoints are not substituted. No TAPVid dataset is used.

A new private environment contains Python 3.12.10, Torch 2.9.1+cpu, NumPy 2.2.6 and sixteen exact official wheel artifacts. Offline installation uses required wheel hashes. Static wheel/installed-record provenance and license files are retained. Execution uses isolated, no-site-hook, no-bytecode startup, CPU float32, four intra-op threads, one inter-op thread, seed zero and deterministic algorithms. Strict safe tensor-only loading accepts 218 state keys and 54,699,335 parameters. The constructor uses the upstream literal parameter use_casual_conv=True with pyramid level one; effective causal flags and unchanged defaults are checked. No production dependency, model, provider or lock changes.

All original 320-by-240 gray planes are retained. Each current gray plane is repeated into three channels, resized with the upstream float32 bilinear operation to 256-by-256 and normalized to minus one through one. This is a fixed grayscale route; color inputs, other resolutions, thresholds, threads and backends are not swept. Four automatically derived software queries use the same admitted fully confirmed reference as the descriptor experiment: the existing stored MCP, PIP and DIP support origins, plus the unrounded raw model index-tip point. These are software registration bases, not physical endpoint truth or manual same-finger confirmation. The cached historical output and the admitted retained-source ledger are distinct; the latter establishes the reference's software confirmation.

The source audit verifies the half-pixel query/raster codec and its single inverse, then the original Reach endpoint normalization and native-view unmirror used by the existing circle scorer. Model resize dimensions 320/240 and Reach endpoint divisors 319/239 serve different coordinate operations. No clamping, nearest-support-tip selection, refined published-point substitution or invented 21-landmark/Z envelope is used.

## Causal chronology and complete counts

Exactly 462 rows precede the reference and retain NO_REFERENCE_YET with no prediction fields. The single seed supplies immutable query features and initial causal state. It is predicted once, followed by all 873 later frames, for 874 model calls. Each prediction sees one current frame, fixed query features and the previously returned causal state. There is no future-frame feature initialization, later neural-point guidance, reseeding, prompt-boundary reset or forced query passage. Reading whole-file bytes for integrity is separate from model context.

| Prompt       | Metadata | Before reference | Seed | Later predictions | Model-visible tip | DIP plus other diagnostic |
| ------------ | -------: | ---------------: | ---: | ----------------: | ----------------: | ------------------------: |
| ALL          |     1336 |              462 |    1 |               873 |               196 |                       137 |
| CENTER       |      109 |              109 |    0 |                 0 |                 0 |                         0 |
| BOTTOM       |      145 |              145 |    0 |                 0 |                 0 |                         0 |
| TOP          |      107 |              107 |    0 |                 0 |                 0 |                         0 |
| LEFT         |       90 |               90 |    0 |                 0 |                 0 |                         0 |
| RIGHT        |       89 |               11 |    1 |                77 |                 2 |                         2 |
| TOP-LEFT     |       73 |                0 |    0 |                73 |                32 |                        31 |
| TOP-RIGHT    |       74 |                0 |    0 |                74 |                 9 |                        13 |
| BOTTOM-LEFT  |       71 |                0 |    0 |                71 |                47 |                        44 |
| BOTTOM-RIGHT |       71 |                0 |    0 |                71 |                14 |                        15 |
| RELAXED      |      109 |                0 |    0 |               109 |                31 |                         0 |
| SWEEP        |      180 |                0 |    0 |               180 |                48 |                        25 |
| OPEN-PALM    |       91 |                0 |    0 |                91 |                 9 |                         7 |
| HIDE         |       18 |                0 |    0 |                18 |                 0 |                         0 |
| RECOVER      |      109 |                0 |    0 |               109 |                 4 |                         0 |

The model emits finite, in-bounds raw tip coordinates for all 873 later frames, but only 196 pass its unchanged learned visibility formula. Visibility is the product of the two complementary sigmoid scores, strictly greater than 0.5. The DIP-plus-other diagnostic requires visible, in-bounds support queries with at least 15 analysis pixels of spacing in both reference and current predictions. It excludes the tip query and totals 137 frames. It does not test the application's normalized-correlation material ownership, current selected digit, source/anatomy eligibility or recovery. Thus its count can differ from tip visibility in either direction.

Recording prompts are instructions, not independently verified pose or motion labels. Zero visible predictions in HIDE and four in RECOVER are raw counters, not a false-positive rate or four successful recoveries. No raw or predicted point gains application freshness, identity, calibration or measurement authority.

## Fixed native48 comparison and uncertainty

The prior independent AI review supplies 48 exposed development references: 37 visible, six ambiguous and five not visible; 37 have point estimates and eleven have none. Thirty-one satisfy the existing positive predicate. Six positive references precede the seed and remain explicitly uncomputed by this method; the paired post-reference cohort is 25, comprising RIGHT eleven, BOTTOM-RIGHT nine and SWEEP five. All 48 reference rows and all 1,336 status rows remain in the private score. The unchanged circle radii of 10–15 native pixels describe coarse AI development uncertainty, not physical ground truth or a held-out accuracy estimate.

| Post-reference positive cohort | Reference circles | Cached NN raw finite | Cached NN inside circle | New raw inside circle | New model-visible/in-bounds | New visible/in-bounds inside circle |
| ------------------------------ | ----------------: | -------------------: | ----------------------: | --------------------: | --------------------------: | ----------------------------------: |
| RIGHT                          |                11 |                   11 |                       9 |                     3 |                           0 |                                   0 |
| BOTTOM-RIGHT                   |                 9 |                    1 |                       0 |                     0 |                           0 |                                   0 |
| SWEEP                          |                 5 |                    4 |                       3 |                     3 |                           2 |                                   2 |
| ALL                            |                25 |                   16 |                      12 |                     6 |                           2 |                                   2 |

The comparator in this table is the original cached raw NN8 output. It yields 16/31 circle containments over the whole positive set, including four of the six pre-reference positives. The earlier reflection experiment's ORIGINAL_CPU rerun yielded 21/31 with RIGHT 11/11; those are different historical predictions and routes. They must not be inherited as this cached baseline. Source inspection confirms reuse of the endpoint predicates and coordinate formulas. Independent arithmetic recomputes the present cached-NN/TAPIR scores. A separate historical endpoint comparison finds no identical coordinates among 36 jointly in-bounds references; it does not assert numerical equality with the prior CPU rerun.

The new tracker supplies all 25 post-reference raw coordinates, but nineteen lie outside their reviewed circles and 23 fail the unchanged model visibility criterion. Only two post-reference positive reference predictions are both visible/in-bounds and inside a circle, both in SWEEP. Extra finite coordinates therefore supply no trustworthy output-availability improvement. No BOTTOM-RIGHT circle containment is gained, and the RIGHT regressions reject the fixed route before any production adaptation.

Using the unchanged disjoint circle-distance intervals, the 25 post-reference positives contain one raw interval improvement in SWEEP, three regressions in RIGHT, twelve overlapping/uncertain comparisons and nine unpaired missing comparisons. With the diagnostic visibility/in-bounds qualifier, two comparisons overlap and 23 are unpaired; none earns interval improvement. Missing outputs and the six earlier uncomputed cases are never treated as improvements. Five contrary open-palm labels overlap the visibility categories. All five have cached raw endpoints, while none passes the new visibility qualifier; these sparse labels and an unexercised application semantic gate do not define a physical false-identification rate.

The new route consumes archival gray-replicated input; the cached neural output comes from its historical provider/input/runtime route. This is a source-joined archival route comparison, not an isolated weights-only experiment or a matched current-hardware CPU benchmark. Dense fingertip accuracy, physical digit identity, identity switches, jitter, recovery delay and controller usability remain unavailable.

## Cost, independent checks and process ownership

| Recorded component                              | Samples / metadata | Conventional median ms | P95 nearest rank ms | Maximum ms |
| ----------------------------------------------- | -----------------: | ---------------------: | ------------------: | ---------: |
| Current gray expansion / resize / normalization |        874 / 1,336 |                  0.854 |               1.341 |     2.1235 |
| Seed reference features and query extraction    |          1 / 1,336 |               206.1346 |            206.1346 |   206.1346 |
| Current feature encoder and causal refinement   |        874 / 1,336 |               271.2713 |            332.1711 |   367.3755 |
| All metadata rows before result-row persistence |       1336 / 1,336 |              252.93935 |            327.6434 |   519.0114 |

All expected costs are present, finite and nonnegative. The 874 current encoder/refinement calls range from 219.9146 to 367.3755 ms; all 874 exceed the unchanged 150 ms budget. The native field includes current feature encoding plus causal trajectory estimation. Preparation and seed reference extraction are separate. The all-row wall field includes 462 metadata-only rows and stops before result-row JSON/write/flush; its seed row additionally includes reference-feature descriptor hashing and reference-query artifact serialization/write. Its median is not an isolated inference measurement. Components overlap and are not summed as independent latency.

Whole-payload monotonic elapsed time is 244,437.7724 ms, covering setup, 1,336 metadata rows, 874 model calls, persistence and completion checks. Final receipt writing and owned cleanup are outside that boundary. These denominators describe offline work, not camera cadence, current observation freshness, browser throughput, capture-to-visible latency or production performance. Historical captures are used only as exact joins; no clock is transplanted into application measurement eligibility.

A separately frozen three-query synthetic smoke precedes the recording run and checks safe exact loading, causal flags, finite outputs and coordinate/visibility serialization. Its four core calls also exceed 150 ms. The recording run is separately source/input reviewed and cleared once. All 22,448 pinned source/runtime/input files, totaling 1,254,677,089 bytes, match before and after execution; all 22,417 predecessor runtime pins remain an exact ordered prefix. Pins do not constitute a complete transitive Windows system-DLL loader closure.

The actual process uses a creation-bound Windows Job, a 900-second child deadline and fresh owned temporary/output directories. Exit zero, descendant tree reaped and streams closed are recorded. Cleanup passes with escalation true. No shared browser, preview, camera, application service or database is invoked. Failed metadata acquisition and the unexecuted superseded smoke-launcher preparation remain preserved.

An independently authored standard-library checker is frozen and source-reviewed before outcome access. Eight pure boundary contracts pass with zero failures, errors or skips. The single actual checker passes all 1,336 joins, four-query codecs, 3,496 logit/probability comparisons, original visibility/bounds/spacing booleans, all fourteen producer groups and complete cost/missing denominators. Maximum double-versus-recorded-float32 probability delta is 8.296322451251115e-8, within the predeclared 1e-6 arithmetic tolerance; the stored float32 probability controls the Boolean. Neural arithmetic is not independently rerun.

The fixed native48 scorer and its aggregate extractor are independently source-reviewed before result access. Another reviewer independently recomputes all 48 native circle comparisons without importing the scorer or model. The aggregate extractor uses a strict constructed privacy allowlist and exact source/protocol/result bindings. The independent native48 audit records 1,677 scalar/field comparisons with zero mismatches and a maximum center-distance difference of 5.68e-14 native pixels. A separate safe-publication readback compares 3,431 leaves, including 3,300 numeric leaves, with zero mismatches. These checks establish arithmetic, provenance and reporting consistency; they establish no physical or application acceptance.

## Reproduction, disposition and remaining boundary

The experiment runs on clean source 83fab6a5d567e1a252ad4bf3394ef965be12da30. Exact private command bindings retain executable, immutable environment/model/source/input pins, review hashes and fresh output paths. Results are flushed chronologically before advancing. Public JSON is copied byte-for-byte from checked outputs and exempted from text conversion and formatting.

| Artifact                                 | SHA-256                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Exact causal checkpoint                  | 87c1e752cf5ce56e3e2f7da460aeb4d40fc826d04ef2939bade86a5c7495377f |
| Recording source/runtime/input freeze    | e7e29fcf3181e7aa1f578c72b95ed77c0332c39cdd98871d866512aa606ac35c |
| Fixed recording protocol                 | ed5a77118d14ba08ad9b4dce9fdf88316016d6ab5d6b544f955122598c8aab70 |
| Actual recording artifact admission      | 64795f34181ed189f4485dca56bee7781ed328316ee1d9e534a89fe13313ddae |
| Raw trajectory results, 1,535,348 bytes  | 2a7ea64d435182d2b2ce6953f28a41ea5d8c7e21afdf6997b0492da78131ad8d |
| Actual payload final                     | a640bab19606ad4d135f78e3687df20bd2fec8d98e2cc935d4848251cc30b919 |
| Actual owned execution                   | 43aee10b92ed015cf5d58d279b5081b141dd42aba42b56ffaa1865a4190e7824 |
| Arithmetic checker freeze                | 50459a34e66c3b59f2ff3401e84349b13615ee240f0a9c6838c1143675e973df |
| Exact sequence aggregate                 | be09fe6d36bbcab07d288c4f22ab85a0f32bf3b20c12947aea7107f2d279d7ac |
| Fixed native48 scorer freeze             | 911eea19f2d7177b1efcc7d04267c270e0df004414b2d1f058412cff9b618efe |
| Native48 private score                   | fa6a39e8655849b56bd01da5d2d8e95d9070e59d617a1c9668ff06992d2f5789 |
| Native48 safe extractor freeze           | 39e9fa0aa8cf85eea1fb56561e6c2f7fa360b044f1ddb95a3ee0433c38dc2ef9 |
| Exact native48 aggregate                 | 9b10867d70277ccd19e8435c15e2270f7ea1ce9ad9376be10038d0712478a5ef |
| Independent native48 numeric review v2   | 40140676b48b49767ba20f9d7e66880af6b924477ce6feddf0d9962b8f85415a |
| Actual arithmetic-check result review    | dc46d89b0806f718194c1774b598ea33f80bec358cbf9f8ff1c48bd3b056a176 |
| Actual safe aggregate publication review | 07b45b165d329705bf21db9ef6d478142c58c08b23f3df6aabce3bdfceca708a |

A read-only hardware/source feasibility audit identifies an RTX 5070 Laptop GPU and an official Torch 2.9.1 CUDA128 Windows/Python3.12 wheel. The pinned [PyTorch Windows build source](https://github.com/pytorch/pytorch/blob/d38164a545b4a4e4e0cf73ce67173f70574890b6/.ci/pytorch/windows/cuda128.bat#L35-L39) includes architecture 12.0, and [NVIDIA CUDA 12.8.1 notes](https://docs.nvidia.com/cuda/archive/12.8.1/cuda-toolkit-release-notes/index.html) document that architecture and a lower minimum driver than the observed one. This supports native GPU feasibility research only. No GPU wheel binary, GPU model run, deployment/export, browser support, operator closure, memory fit or accelerated latency is verified. The rejected fixed route does not justify a performance-only promotion.

The retained selected-index, current-image/source/anatomy, freshness, coordinate error, probation, calibration sample and independent held-out validation gates are unchanged. No manual same-finger confirmation, guessed application position, Phase 2, Crossdeck or shared acceptance change is introduced. The sealed 32 analytic controls remain unexecuted and unseen by the prospective perception author. No eligible perception candidate exists to consume that holdout. Existing mixed-motion failures and the protected Product Experience refusal remain unresolved.

This conclusion is limited to the pinned grayscale single-reference causal route. Required RIGHT and mixed-motion reliability improvement is not demonstrated. Phase 1, physical readiness and the owner's perception mission remain unaccepted.
