# Vision B-6 Replay Report

Dataset: `synthetic-v1-2026-07-18` (SYNTHETIC_MATHEMATICAL_FIXTURE)

Result: **SYNTHETIC_GATE_PASS**

> This corpus executes production engine code but is not Sea of Thieves field evidence and cannot approve automatic or public release.

## Metrics

- Cases: 27; passed: 27; failed: 0.
- Confirmed false accepts: 0 / 6 locked or regression negatives.
- Zero-observation upper 95% bound: 50.00%.
- First-scan synthetic positive success: 12 / 12 (100.00%).
- Runtime p50/p95/p99: 44 / 56 / 61 ms.
- Release eligible: **No** — Synthetic evidence cannot satisfy the real-pilot, hardware, usability, signing, or public-release gates.

## Case results

| Case                           | Partition       | Expected                     | Actual                       | Pass | Duration ms | Guidance                   |
| ------------------------------ | --------------- | ---------------------------- | ---------------------------- | ---- | ----------: | -------------------------- |
| pilot1-calibration-positive    | CALIBRATION     | VERIFIED                     | VERIFIED                     | yes  |          56 | VERIFICATION_COMPLETE      |
| pilot1-calibration-negative    | CALIBRATION     | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          48 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot1-validation-positive     | VALIDATION      | VERIFIED                     | VERIFIED                     | yes  |          61 | VERIFICATION_COMPLETE      |
| pilot1-validation-negative     | VALIDATION      | NOT_VERIFIED                 | NOT_AT_TARGET                | yes  |          44 | LOCATION_NOT_CONFIRMED     |
| pilot1-locked-positive         | LOCKED_POSITIVE | VERIFIED                     | VERIFIED                     | yes  |          50 | VERIFICATION_COMPLETE      |
| pilot1-locked-negative         | LOCKED_NEGATIVE | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          44 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot1-regression-positive     | REGRESSION      | VERIFIED                     | VERIFIED                     | yes  |          43 | VERIFICATION_COMPLETE      |
| pilot1-regression-negative     | REGRESSION      | NOT_VERIFIED                 | NOT_AT_TARGET                | yes  |          44 | LOCATION_NOT_CONFIRMED     |
| pilot1-regression-insufficient | REGRESSION      | INSUFFICIENT_VISUAL_EVIDENCE | INSUFFICIENT_VISUAL_EVIDENCE | yes  |          22 | TOO_DARK                   |
| pilot2-calibration-positive    | CALIBRATION     | VERIFIED                     | VERIFIED                     | yes  |          48 | VERIFICATION_COMPLETE      |
| pilot2-calibration-negative    | CALIBRATION     | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          45 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot2-validation-positive     | VALIDATION      | VERIFIED                     | VERIFIED                     | yes  |          51 | VERIFICATION_COMPLETE      |
| pilot2-validation-negative     | VALIDATION      | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          41 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot2-locked-positive         | LOCKED_POSITIVE | VERIFIED                     | VERIFIED                     | yes  |          49 | VERIFICATION_COMPLETE      |
| pilot2-locked-negative         | LOCKED_NEGATIVE | NOT_VERIFIED                 | NOT_AT_TARGET                | yes  |          40 | LOCATION_NOT_CONFIRMED     |
| pilot2-regression-positive     | REGRESSION      | VERIFIED                     | VERIFIED                     | yes  |          43 | VERIFICATION_COMPLETE      |
| pilot2-regression-negative     | REGRESSION      | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          41 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot2-regression-insufficient | REGRESSION      | INSUFFICIENT_VISUAL_EVIDENCE | INSUFFICIENT_VISUAL_EVIDENCE | yes  |          19 | TOO_DARK                   |
| pilot3-calibration-positive    | CALIBRATION     | VERIFIED                     | VERIFIED                     | yes  |          46 | VERIFICATION_COMPLETE      |
| pilot3-calibration-negative    | CALIBRATION     | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          49 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot3-validation-positive     | VALIDATION      | VERIFIED                     | VERIFIED                     | yes  |          52 | VERIFICATION_COMPLETE      |
| pilot3-validation-negative     | VALIDATION      | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          43 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot3-locked-positive         | LOCKED_POSITIVE | VERIFIED                     | VERIFIED                     | yes  |          50 | VERIFICATION_COMPLETE      |
| pilot3-locked-negative         | LOCKED_NEGATIVE | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          43 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot3-regression-positive     | REGRESSION      | VERIFIED                     | VERIFIED                     | yes  |          47 | VERIFICATION_COMPLETE      |
| pilot3-regression-negative     | REGRESSION      | NOT_VERIFIED                 | AMBIGUOUS                    | yes  |          44 | AMBIGUOUS_SIMILAR_LOCATION |
| pilot3-regression-insufficient | REGRESSION      | INSUFFICIENT_VISUAL_EVIDENCE | INSUFFICIENT_VISUAL_EVIDENCE | yes  |          21 | TOO_DARK                   |

## Truth boundary

This report does not certify Sea of Thieves reliability, automatic progression, Creator Preview, or Stable release.
