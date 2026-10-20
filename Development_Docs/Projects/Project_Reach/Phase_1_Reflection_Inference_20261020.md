---
title: Reach Phase 1 fixed reflection inference experiment
audience: product-engineering
status: rejected-fixed-replacement-perception-mission-incomplete
canonical_for: reach-phase1-reflection-inference-20261020
last_reviewed: 2026-10-20
---

# Reach Phase 1 fixed reflection inference experiment

**FIXED REFLECTION REPLACEMENT REJECTED; PHASE 1 NOT READY.** One complete 1,336-frame raw neural comparison finds a BOTTOM-RIGHT localization signal but demonstrates no RIGHT or mixed-motion improvement. SWEEP and BOTTOM lose sole in-bounds outputs. No tracking candidate is nominated or promoted. Production tracking remains at `62ebde00a7dd9c623a20b46e20d6f4e9d63dfe99` on existing draft PR #769; the owner's perception mission remains incomplete.

The [complete image and identity diagnostic](Phase_1_Complete_Image_Diagnostic_20261019.md) preserves the original 504/1,336 admitted positions, RIGHT 13/89 and distinct source/image rejection mechanisms. This experiment changes neither that baseline nor its failed mixed-motion assertion. It tests one new input-orientation hypothesis with the existing model, rather than another threshold, crop, angle or registration sweep. The [raw aggregate](evidence/reflection-inference-20261020/raw-pair-summary.json) and [reference comparison](evidence/reflection-inference-20261020/reference-summary.json) preserve every category and denominator without media, landmark arrays, coordinates, source IDs or private paths.

## Fixed method and provenance

The method, scorer and aggregation source were frozen before outcome inspection. Both arms use the current Watchglass actual-ROI recovery provider, CPU delegate, identical pinned weights and current thresholds. Each has separate worker and retained-region history. Both pass the existing two actual-size 640-by-480 startup screens within 150 ms, discard synthetic outputs and reset before the chronological recording. Startup success is a necessary synthetic capacity screen, not live tracking qualification.

Saved native PNGs already contain the mirrored preview. Both arms first undo that common preview mirror into camera convention. Only the reflected arm then applies the exact integer RGBA permutation x to 639 minus x, with no interpolation, scale, crop or rotation. Each worker hashes the exact received ImageBitmap immediately before passing that same unchanged object to inference. All 2,672 received hashes match their corresponding arm canvas; all 1,336 sequential grayscale-plane hashes match the saved canonical stream. Independent admission checks all 531 source pins, installed browser executable/library, original chronology, native manifest and references.

All 1,336 source indices, original capture timestamps and 14 prompt strata remain chronological without prompt resets. Original-first/reflected-first order alternates by corpus ordinal. Historical timestamps drive provider caches only. Each successful pair is persisted before the next exposure. Both raw result objects retain landmarks, world landmarks and handedness unchanged. A separate diagnostic image-coordinate inverse changes only normalized x to one minus x without clamping; it grants no handedness, world-coordinate, source-alias or selected-index equivalence.

This is the first completed neural pair in this experiment. A preceding source freeze was held before execution because it proved only canvas bytes rather than the transferred bitmap. The next launch failed on a Windows ESM drive-path import before module evaluation, browser or inference. The separately reviewed successor corrects only that import to a file URL. A later offline scorer command stops before reading results because its reference path is wrong; the corrected command uses the already frozen reference path and rules. All holds and failed receipts remain preserved. No inference was repeated after viewing outcomes.

## Raw availability across every category

Available here means exactly one raw hand with 21 slots, finite XYZ at slot 8 and in-bounds XY. It does not mean a correct selected index, valid gesture, trusted source, fresh application measurement or calibration sample. Zero, multiple, invalid and out-of-bounds results remain in denominators; no nearest-hand choice is made.

| Prompt       | Frames | Original available | Reflected available |
| ------------ | -----: | -----------------: | ------------------: |
| CENTER       |    109 |                 97 |                  98 |
| BOTTOM       |    145 |                107 |                  81 |
| TOP          |    107 |                107 |                 107 |
| LEFT         |     90 |                 90 |                  90 |
| RIGHT        |     89 |                 89 |                  89 |
| TOP-LEFT     |     73 |                 72 |                  73 |
| TOP-RIGHT    |     74 |                 71 |                  73 |
| BOTTOM-LEFT  |     71 |                 70 |                  70 |
| BOTTOM-RIGHT |     71 |                 31 |                  51 |
| RELAXED      |    109 |                 90 |                 109 |
| SWEEP        |    180 |                165 |                 155 |
| OPEN-PALM    |     91 |                 91 |                  91 |
| HIDE         |     18 |                 18 |                  18 |
| RECOVER      |    109 |                 83 |                  83 |
| ALL          |  1,336 |              1,181 |               1,188 |

Across all frames, zero-hand results fall from 110 to 55, while multiple-hand results increase from 24 to 46 and sole-hand out-of-bounds results increase from 21 to 47. BOTTOM-RIGHT gains 20 raw available endpoints, but BOTTOM loses 26 and SWEEP loses ten. Prompt names are recording instructions, not independently established physical poses. Outputs in OPEN-PALM or HIDE are not automatically false pointers: this run does not invoke application semantic admission.

The new original arm is a new inference on decoded native PNGs, not byte-identical replay of the older video-worker neural inputs. Compare these two new arms with each other. The 1,181 raw availability count cannot be compared as an improvement over the original 504 admitted application positions.

## Fixed development references

All 48 existing AI development annotations are retained: 37 visible, six ambiguous and five not visible. There are 31 visible plausible-pointing index positives. Five contrary-open-palm cases overlap the 48; they are not five extra observations. These references were fixed before the new reflection outcomes but are previously exposed development estimates with 10-15 pixel uncertainty radii. They are not untouched physical ground truth.

Raw image coordinates are mapped into the existing mirrored native pixel-center convention before scoring. Missing, malformed and multiple-hand results stay missing. No best arm, closest landmark, world output or confidence score is substituted. Wrong-digit correctness remains UNKNOWN.

| Positive reference group | Positives | Original valid / inside circle | Reflected valid / inside circle |
| ------------------------ | --------: | -----------------------------: | ------------------------------: |
| LEFT                     |         6 |                          6 / 6 |                           6 / 6 |
| RIGHT                    |        11 |                        11 / 11 |                         11 / 11 |
| BOTTOM-RIGHT             |         9 |                          6 / 0 |                           6 / 5 |
| SWEEP                    |         5 |                          5 / 4 |                           4 / 4 |
| ALL                      |        31 |                        28 / 21 |                         27 / 26 |

Among the 26 positives with valid endpoints in both arms, four reflected error intervals are strictly better and 22 overlap; no strictly worse paired interval is recorded. All four clear improvements are BOTTOM-RIGHT. Five positives remain unpaired: two original-only, one reflected-only and two missing in both. Within BOTTOM-RIGHT, four outside-circle endpoints become inside, one missing endpoint becomes inside, one outside endpoint becomes missing, one stays outside and two stay missing. SWEEP loses an outside-circle endpoint to a multiple-hand result; this is missing output, not an accuracy improvement.

Conditional median/P95 center error is 5.08/131.40 native pixels for the original 28 valid positives and 4.77/7.61 for the reflected 27. These distributions have different support and exclude missing results. The paired interval and availability transitions above prevent the conditional tail reduction from hiding lost outputs. All five contrary cases have raw endpoints in both arms; no false-pointer or false-identity rate can be derived from that fact.

The evaluator's separate Python implementation matches all 48 scored rows, memberships, statuses, errors, intervals and summaries across 1,890 comparisons, with maximum numerical difference below 0.0000000001 pixel. The scorer's author also authored this recomputation; it is separate from the prospective perception author and uses no scorer execution or neural rerun. Another reviewer independently checks method, source, actual byte linkage, lifecycle and reporting. Sparse references do not establish accuracy on every RIGHT or SWEEP frame. The safe reference comparison retains zero-reference categories as unavailable, rather than dropping them.

## Cost and lifecycle

| Recorded component | Original median / P95 ms | Reflected median / P95 ms |
| ------------------ | -----------------------: | ------------------------: |
| Worker inference   |            32.13 / 45.83 |             32.29 / 46.43 |
| Worker round trip  |            33.95 / 47.74 |             34.13 / 48.31 |

Shared preparation is 22.78/28.57 ms median/P95; reflection preparation is 7.79/8.89 ms. The whole paired row is 103.81/127.41 ms. These include diagnostic bitmap preparation/readback/hash work. Round trip contains worker verification and inference, so nested components must not be added. The safe aggregate retains every component's count, missing/invalid denominator, quantiles and sum for ALL and every prompt; no timing field is absent or invalid.

The aggregate's author separately recomputes its arithmetic in Python without executing the aggregation source. All 1,910 numeric/boolean leaves match, including 165 component summaries and 14,696 valid timing samples. This also rechecks every source chronology, grayscale-plane and received-bitmap hash. The review is separate from the prospective perception author; it is an arithmetic/provenance check, not a physical correctness result.

Whole-payload wall time is 157,950 ms, or 8.46 paired rows/second, including both arms, startup, IO, instrumentation and cleanup. This timestamp-derived wall rate is not monotonic production throughput, real-camera cadence, capture-to-visible latency or proof that live packets meet the existing 150 ms freshness rule. New elapsed costs are never transplanted into historical capture/completion clocks.

Normal worker, browser and browser-control server closure, direct browser exit and control-port release are independently verified. The creation-bound Windows Job Object also reports its descendant tree reaped and streams closed. Its cleanup receipt explicitly records escalation; the result does not claim an escalation-free exit. No application HTTP server, owner preview, shared port, camera, database or external service is used.

## Reproduction and retained boundaries

The run uses clean source `f6bd4ec49a3dabd9255984effe7915601d4328e7`. The private freeze binds seven experiment files plus existing provider assets, process helpers and dependency closure. Frozen root commands name exact input hashes and fresh output paths. The raw scorer requires 1,336 unique rows, all 48 exact reference joins and frozen reference membership. The aggregate additionally verifies every received-bitmap and grayscale-plane hash, full chronology, all 14 strata, output caps and separate normal/Job cleanup receipts before accepting metrics. Their authors use separate Python implementations for numerical recomputation; no outcome-based rule changes occur.

| Artifact                               | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| Inference source freeze                | `85cea6673ad8796f182f3c19270de1692ad0afb32df4b928f5c8ec40191c53f7` |
| Actual pair admission                  | `7da4a62bab0dc4a9003bb8a6a12942d2486f7a0db22c3186630977d1001503f3` |
| Raw paired results, 14,283,214 bytes   | `5be8db7ffcee3da9ef19d511e68c7ea095630baa22abe11dc36bb7119d60094e` |
| Canonical grayscale, 102,604,800 bytes | `d91e0f49cc9954dfead0fce1c1e5f5c2996fb55293da266197f8833daeef0c8a` |
| Native reference derivation            | `2fd0319b52bc0800fb92c2d0336be5068caf1f84d64bec97dc3b2a3b602130ff` |
| Complete private reference score       | `70af310e054e0fe4181f6f3b5ca82790b2ce34e4403cf176e08f135dde1fcdff` |
| Safe raw aggregate                     | `0fa8136b4dff8120439e364dadef66ebb4a2e7a794540f1f72352aff83c2e7ac` |
| Safe reference comparison              | `12c938837d01679cc5ca8d2a25bbfa2b6d530ebe532aa4d74d72ebc36049867b` |

Six exact-reflection/image-mapping contracts and twelve reference-scorer contracts pass. Their original process exits and SPEC stdout summaries are retained; an initial parent parser incorrectly expected TAP, and separately derived parsing receipts preserve that reporting failure without rerunning tests. The full actual neural pair passes once, followed by one completed frozen aggregation and one completed frozen score. The earlier application's broad mixed-motion failure and protected Product Experience refusal remain unresolved; they are not replaced by these math, raw inference or documentation checks.

This evidence publication changes no product capability. All calibration/identity/freshness/anatomical/coordinate/sample gates remain intact, with no guessed positions or manual same-finger confirmation. The sealed analytic controls remain unexecuted and were not inspected by the prospective perception author. No untouched physical holdout, dense independent endpoint truth, false-digit denominator, anatomical identity-switch rate, recovery delay, physical jitter, sensor-to-display timing or new controller/calibration result is available.

The limited BOTTOM-RIGHT signal is retained as a research finding. An unconditional reflected provider does not demonstrate the required RIGHT and mixed-motion gains and has important raw availability regressions; it is rejected for production promotion. Further work must address independent current-image/source reproof and actual motion/identity behavior rather than choosing an arm by reference distance or relaxing an admission gate. Phase 1 and the perception mission remain unaccepted.
