# Phase B-4 Pilot and Demonstration Report

## Status

The reproducible software demonstration is implemented and automated. The required field demonstration is **not complete** because no real Sea of Thieves pilot recordings are present. The three fixtures below are mathematical engine fixtures, not pilot waypoint packages eligible for a field reliability claim.

## Synthetic demonstrations

| Fixture                        | Profile        | Accepted region                                             | Positive | Hard negative | Weak evidence                |
| ------------------------------ | -------------- | ----------------------------------------------------------- | -------- | ------------- | ---------------------------- |
| Easy exact landmark            | BALANCED       | bounded planar polygon and orientation/visibility rules     | VERIFIED | NOT_AT_TARGET | INSUFFICIENT_VISUAL_EVIDENCE |
| Moderate natural location      | STRICT         | wider planar area with independent reference segments       | VERIFIED | AMBIGUOUS     | INSUFFICIENT_VISUAL_EVIDENCE |
| Difficult confusable viewpoint | STORY_CRITICAL | narrow pose/orientation region and stronger negative margin | VERIFIED | AMBIGUOUS     | INSUFFICIENT_VISUAL_EVIDENCE |

Each fixture uses separate target/reference, nearby and distant negative, validation, and locked-test frame sets. Runtime inputs are not reused from the build references. All fixtures run the same general engine without pilot IDs or locations in runtime logic.

## Reproduce the engine demonstration

```powershell
npm run companion:test
node scripts/run-vision-b4-replay.cjs --output Development_Docs/AR/Phase_B4/Evidence/synthetic-replay-report.json
```

Expected behavior:

1. Three builds complete through curation, global/local features, reference graph, planar reconstruction, target/negative indexes, accepted pose finalization, per-profile calibration, validation, locked tests, packaging, and package reload.
2. Independent multi-frame positives pass all mandatory gates and return `VERIFIED`.
3. Confusable negatives return `NOT_AT_TARGET` or `AMBIGUOUS`, never `VERIFIED`.
4. Blurry/weak evidence returns `INSUFFICIENT_VISUAL_EVIDENCE` with guidance.
5. Corrupted or incompatible packages reject before runtime.
6. A simulated unavailable preferred provider falls back to the active CPU provider and records the attempts.

## Reproduce the Studio shadow flow

This flow requires authorized real creator data and a selected Sea of Thieves window; it was not executed during this task.

1. Enable the five B-4 pilot flags from `B4_Runbook_and_Rollback.md`; keep automatic progression false.
2. Start the desktop Companion and the shared app.
3. Open a B-3 draft and record independent target, accepted-area, hard-negative, validation, and locked-test segments.
4. Select **Build and certify shadow package locally**.
5. Observe real Companion progress and the persisted reliability report.
6. Select **Run five-second shadow scan** with an unseen valid scan, then repeat at a confusable location and with weak framing.
7. Confirm `VisionShadowAttempt` rows contain gate outcomes and evidence digests while no story success event or automatic progression occurs.
8. Corrupt a copy of a test package and confirm the loader returns a system error while the last valid immutable package remains.

## Missing field evidence

- three real materially different Sea of Thieves waypoint packages;
- independent unseen positives, hard negatives, and boundary scans;
- human truth labels and Captain adjudication samples;
- first-scan and guided-retry success rates;
- locked-corpus false-accept observation and confidence bound;
- live CPU/GPU/memory and game-impact capture;
- screen-recorded Studio-to-Companion build and shadow scan.

Until those exist, `EXCELLENT` in synthetic reports means only that the fixture passed its mathematical locked tests. It is not an automatic-readiness or product-reliability designation.
