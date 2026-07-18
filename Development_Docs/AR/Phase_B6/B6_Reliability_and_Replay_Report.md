# Phase B-6 reliability and replay report

## Evidence boundary

Dataset `vision-b6-synthetic-corpus`, revision `synthetic-v1-2026-07-18`, manifest hash `sha256:2aa5006b9c3352d17cdc62389a4b9b61b596bea670ee37d2ad4b4ea780e9843b`, contains 33 human-reviewed synthetic mathematical fixtures split across build/reference, calibration, validation, locked positive, locked negative, and regression partitions. Partition and asset hashes are validated before execution.

The fixtures execute the production B-4 builder and mandatory runtime gates, but contain no Sea of Thieves footage and are not independent field evidence. They cannot certify a waypoint or approve automatic/public release.

## Release-tier result

Command:

```powershell
npm run vision:b6:replay -- --parallel 3 --fail-on-regression --output-json Development_Docs/AR/Phase_B6/Evidence/b6-release-replay.json --output-markdown Development_Docs/AR/Phase_B6/Evidence/b6-release-replay.md
```

- Result: `SYNTHETIC_GATE_PASS`, release eligible: false.
- Attempts: 27/27 matched their expected safe result.
- Positives: 12/12 synthetic first scans verified.
- Locked/regression negatives: 6; confirmed false accepts: 0.
- Positive Wilson 95% interval: 75.75% to 100%; this small sample does not prove the 95% field target.
- With zero events among six relevant negatives, the rule-of-three 95% false-accept upper bound is 50%; this is not evidence of “100% accuracy.”
- Guided two-attempt success: not measured because no human guidance pairs exist.
- Runtime: p50 44 ms, p95 56 ms, p99/max 61 ms on the single local CPU provider.
- Wall time: 2.069 seconds; report hash `sha256:750dedc76e59509057437cf4a65692ae0442755026757d18b8799bbb0c0cbcde`.

Per-attempt gate, pose, similarity, negative margin, local match, geometry, coverage, temporal, guidance, memory, package, engine, and model details are in [b6-release-replay.json](Evidence/b6-release-replay.json). The human summary is [b6-release-replay.md](Evidence/b6-release-replay.md).

## Bounded soak

Fifteen builds and 250 scans completed with 84 expected verifications, 166 expected non-success results, and zero system errors. Runtime p95 was 53 ms. RSS grew 257,368,064 bytes against a 268,435,456-byte budget, leaving limited headroom; this must be investigated during the required multi-hour field soak. It did not measure native capture, GPU/VRAM, thermals, game frame time, sleep/resume, or sustained Sea of Thieves play. Evidence: [b6-synthetic-soak.json](Evidence/b6-synthetic-soak.json).

## Missing release evidence

- zero real pilot waypoints and zero locked Sea of Thieves cases;
- no independent truth-label reviewers;
- no guided retry pairs, weather/FOV/graphics/display field coverage, or strongest real confusers;
- no GPU provider validation;
- no per-waypoint automatic certification.

B6-005 and B6-006 remain release blockers.
