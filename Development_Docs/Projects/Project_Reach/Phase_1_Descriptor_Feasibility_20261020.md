---
title: Reach Phase 1 fixed descriptor observability experiment
audience: product-engineering
status: rejected-fixed-method-perception-mission-incomplete
canonical_for: reach-phase1-descriptor-feasibility-20261020
last_reviewed: 2026-10-20
---

# Reach Phase 1 fixed descriptor observability experiment

**FIXED METHOD REJECTED FOR RECOVERY; PHASE 1 NOT READY.** The registered reference yields two ORB query centers, one near MCP and one near PIP, with none in the required DIP region. This fixed query set therefore cannot supply the existing distal-plus-another-region material requirement. No tracking candidate is nominated or promoted. Production tracking remains at commit 62ebde00a7dd9c623a20b46e20d6f4e9d63dfe99 on existing draft [PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769); the owner's perception mission remains incomplete.

The [complete image diagnostic](Phase_1_Complete_Image_Diagnostic_20261019.md) retains the original 504/1,336 admitted positions, RIGHT 13/89, and the separate mixed-motion failure. The [reflection experiment](Phase_1_Reflection_Inference_20261020.md) remains rejected with its gains and regressions intact. This experiment contributes no accepted positions or before/after tracking improvement. The [safe aggregate](evidence/descriptor-feasibility-20261020/safe-aggregate.json) retains all categories, uncomputed states, counts and cost denominators without media, descriptors, coordinates, per-frame identifiers or private paths.

## Question and fixed method

The preceding targeted source audit distinguishes this hypothesis from the already tested photometric methods. Earlier sparse tracking detected Shi-Tomasi corners and propagated them with pyramidal Lucas-Kanade; other trials used gradient or normalized-correlation matching and registered image warps. Within the fourteen inspected sources, none implements the descriptor re-detection and discrete cross-capture matching tested here. This bounded audit is not a claim that descriptors have never appeared anywhere in repository history. Earlier texture collapse remains adverse evidence.

One standard OpenCV 4.13.0 ORB configuration is frozen before outcome exposure: nominal 500 features, scale factor 1.2, eight pyramid levels, edge threshold 31, first level zero, WTA_K two, Harris scoring, patch size 31 and FAST threshold 20. Detection uses the entire original 320-by-240 grayscale plane with no mask, crop, resize, contrast adjustment or new model. The method follows the documented [ORB API](https://docs.opencv.org/4.13.0/db/d95/classcv_1_1ORB.html) and [Hamming descriptor matching](https://docs.opencv.org/4.13.0/dc/dc3/tutorial_py_matcher.html).

The single immutable reference is original source frame 464, the last fully confirmed frame that refreshed the finger reference before RIGHT loss. Its integer MCP, PIP and DIP support origins come from the admitted old software state. They are registration evidence, not independently established physical endpoint truth. The refined published tracking point is not substituted for an integer patch origin. Source/capture joins, plane offset and hashes establish the actual cached image; source index is not treated as plane ordinal.

ORB detects the reference globally once. Only descriptors whose centers lie inside an existing radius-seven support square become queries; all global reference descriptors remain reverse competitors. Every later current image is independently detected globally with the same configuration. Each selected reference query is matched against the full current pool, and its current best is reverse-matched against the full reference pool. The retained records include both nearest distances, returned indices, ties and mutual top-one flags. Strict uniqueness requires at least two competitors in both directions and a strict first-to-second distance gap in both directions. It is a mathematical ranking property, not confidence, material identity or spatial round-trip proof.

A diagnostic tests whether strict mutual proposals contain a DIP-labelled reference center and another labelled region, separated by at least 15 analysis pixels in both reference and current images. Even a positive diagnostic would not establish two independently owned material regions, anatomical identity or selected-index recovery: the rotated, pyramid-scale descriptor footprint can extend beyond its registered square. No transform fit, model-guided current target, source reassignment, tracking position, freshness authority, calibration eligibility or application API is produced.

## Complete chronology and result

All 1,336 original metadata rows and grayscale planes remain in order across all fourteen recording prompts. There are 462 rows before reference acquisition, one reference-only row and 873 later feature/matching rows. Earlier rows are explicitly uncomputed; the experiment does not reseed at prompt boundaries or backdate a future reference. The reference has 361 global features, but only two selected query centers: MCP one, PIP one, DIP zero.

| Prompt       | Metadata rows | Later matching rows | Mutual-pair frames | Strict mutual frames | DIP plus other diagnostic |
| ------------ | ------------: | ------------------: | -----------------: | -------------------: | ------------------------: |
| CENTER       |           109 |                   0 |                  0 |                    0 |                         0 |
| BOTTOM       |           145 |                   0 |                  0 |                    0 |                         0 |
| TOP          |           107 |                   0 |                  0 |                    0 |                         0 |
| LEFT         |            90 |                   0 |                  0 |                    0 |                         0 |
| RIGHT        |            89 |                  77 |                 28 |                   21 |                         0 |
| TOP-LEFT     |            73 |                  73 |                 23 |                   18 |                         0 |
| TOP-RIGHT    |            74 |                  74 |                 45 |                   40 |                         0 |
| BOTTOM-LEFT  |            71 |                  71 |                 57 |                   51 |                         0 |
| BOTTOM-RIGHT |            71 |                  71 |                 26 |                   19 |                         0 |
| RELAXED      |           109 |                 109 |                 55 |                   38 |                         0 |
| SWEEP        |           180 |                 180 |                101 |                   80 |                         0 |
| OPEN-PALM    |            91 |                  91 |                 47 |                   38 |                         0 |
| HIDE         |            18 |                  18 |                  8 |                    8 |                         0 |
| RECOVER      |           109 |                 109 |                 65 |                   55 |                         0 |
| ALL          |         1,336 |                 873 |                455 |                  368 |                         0 |

RIGHT also contains eleven pre-reference rows and the one reference-only row. All other earlier rows belong to CENTER, BOTTOM, TOP and LEFT. There are no empty current feature pools and no no-query rows after the reference. Counts represent frames with at least one proposal, not numbers of correct correspondences or accepted fingertip measurements.

The zero DIP-plus-other total is structurally determined by the reference's absent DIP query. It is a coverage limitation of this fixed method, not 873 failed tests of a distal descriptor. Strict mutual matches in OPEN-PALM and HIDE also cannot establish a false-pointer rate: prompt names are instructions, not independently reviewed physical pose labels, and application semantic admission is not exercised. No correspondence correctness labels, dense endpoint truth or physical identity-switch denominator is available.

## Independent arithmetic and controls

Four fixed controls pass with zero failures, errors or skips: known binary matching with input immutability, an explicit duplicate-rival tie, empty pools without fabricated correspondence, and exact binary codec with malformed shape/type rejection. They compute no real-image features. One separately reviewed actual probe then completes; feature extraction is not repeated after outcome exposure.

A separate standard-library Python checker is frozen and source-reviewed before its author or the prospective perception author inspects the outputs. Its completed check passes on all 1,336 rows and all fourteen categories. Integer XOR/popcount recomputes 1,746 selected-query match records against the full current and reference descriptor pools, including exact nearest distances, legitimate tied indices, strict flags and geometry. It verifies the full binary feature encodings, query membership, chronology, all grayscale planes, receipt hashes, output caps and all 2,470 source/runtime/input pins before and after checking. No OpenCV, NumPy, model or application code is imported or rerun by this checker.

The checker is authored by the benchmark evaluator, separately from the prospective perception author. Another reviewer independently checks source, artifact admission, numerical interpretation and reporting. These checks establish consistency of retained arithmetic and provenance, not descriptor repeatability, selected material ownership, recovery or physical accuracy.

## Recorded cost and process ownership

| Recorded component          | Computed / metadata rows | Median ms | P95 ms |
| --------------------------- | -----------------------: | --------: | -----: |
| Feature extraction field    |              874 / 1,336 |    0.8304 | 0.9656 |
| Full-pool matching          |              873 / 1,336 |    0.9937 | 1.1996 |
| Row work before persistence |            1,336 / 1,336 |    2.0026 | 2.4621 |

The feature extraction field combines 873 current-image extractions with one reference measurement that additionally includes query selection and binary packing. The current-image field stops before packing and matching. Thus the 874-row summary has those declared scopes; it is not a uniform isolated detector benchmark. Every expected cost is present and finite. Median uses the central value or pair average; P95 uses nearest rank. The safe aggregate retains missing, invalid and uncomputed denominators, minima, maxima and sums for ALL and every prompt.

Row work excludes JSON serialization, write and flush. Whole-payload monotonic elapsed time is 2,612.7611 ms and includes setup and IO. Components overlap and are neither added nor inverted into production throughput. These offline cached-image measurements establish no camera cadence, capture-to-visible latency, 150 ms live freshness compliance or latency improvement over the application.

The private runtime is Python 3.12.10, NumPy 2.2.6 and existing OpenCV 4.13.0, one CPU thread with OpenCL disabled. Isolated/no-bytecode/no-site-hook startup uses an explicit pinned private package directory. No packages, models or production dependencies are added. The exact runtime, source, inputs and owned helpers are pinned before launch. A creation-bound Windows Job with a 120-second deadline reports direct exit zero, descendant tree reaped and streams closed for controls and actual execution. Both cleanup receipts record escalation; no escalation-free exit is claimed. No browser, camera, shared preview, application server, database or network service is used.

## Reproduction and retained evidence

The experiment runs on clean source 9e6da7e49710fd0c4dea0417b99676b9f0b96792. Private command bindings retain exact executable, environment, source freeze and review hashes, modes, input pins and fresh output paths. The producer preserves each chronological result before advancing. Its feature matrices, descriptors, match records and metadata remain private. The published aggregate is an exact byte copy of the checked safe output, rather than a reformatted or selectively reduced result.

| Artifact                              | SHA-256                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| Source and runtime freeze             | a7887c28c8b1fdbc0e5cc5d9b8eabcb416dcf368441044303d8601f58dadda7a |
| Fixed protocol                        | 619bec8b678308148468e58873b9246200af6db6a9debfdeaaf0bb4ec14d3565 |
| Probe source                          | b40595f8ed60ac65e06fad8abdb08d38743a25c78d44ca3ff73e0a9fe7149615 |
| Actual artifact admission             | 9e0bbbb3afe03e86c0924c42304758de92b75fe058d0716a19e64a897bed5f03 |
| Raw results, 27,489,868 bytes         | 70a0df3fa2de365533166b9bef7248e586dd66538a802542b2adc9520e1a84cf |
| Reference feature file                | b923eae460bee30a009052bf738490876092a94f8f64c976c35d2e06e3b9ca84 |
| Original grayscale, 102,604,800 bytes | bbfed087bf8379266b4127eb25ce033c4b5af54cbb43ef208e3b65a97accc569 |
| Original chronology                   | 3e33ae53b5097b66593209c561e446e0e528cd30e8fcbab618a1b1e89531dab1 |
| Independent checker freeze            | 3dc492c6ab4609f19da0b9e0aaecca9882e329cebfaa511934b89826884130c7 |
| Exact safe aggregate                  | 661287c884ae875b3f2d38d810652ac5d7bbc09744dd4aab95ee7ade6d09dc05 |

Pre-execution reviews retain clarifications about pyramid footprints, insufficient competitor pools, site-hook isolation and owned temporary directories. A negative no-argument launcher check reaches its intended argument refusal before process creation. OpenCV's nominal feature cap can retain boundary response ties; the frozen explicit returned-count guard would fail closed on overflow, without truncation or retry. This actual run completes under all caps. No threshold, feature count, resolution, mask, reference or query region is changed after observing the result.

This evidence publication changes no product capability. Existing source/anatomy/current-image/freshness/coordinate/calibration sample requirements remain intact; there are no guessed positions or manual same-finger confirmations. The sealed 32 analytic controls remain unexecuted, and the prospective perception author has not inspected them. There is no new held-out physical trial, controller/browser acceptance, physical jitter, false-digit rate, recovery delay or sensor-to-display measurement. The original broad mixed-motion failure and protected Product Experience refusal remain unresolved.

The observed query coverage rules out this fixed descriptor method as the required recovery proof. It does not rule out every descriptor approach or authorize relaxing the distal-region requirement. Further work needs independent evidence of current selected-index material and motion continuity. Required RIGHT and mixed-motion improvement has not been demonstrated; Phase 1 and the perception mission remain unaccepted.
