---
title: Project Reach requirements and qualification plan
audience: product-engineering
status: governing-not-implemented
canonical_for: reach-requirements-qualification-plan
last_reviewed: 2026-10-09
---

# Project Reach requirements and qualification plan

This plan traces the full initial constitution to implementation phases and pending scenario declarations. It is a specification and evidence plan, not a passing test record. Numerical gates are in Reach governing Section 27 and must be frozen with a reproducible reference setup before measurement.

| Requirement family             | Governing sections | Phase | Primary scenario declarations                                               | Required proof                                          |
| ------------------------------ | ------------------ | ----- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Browser/provider/lifecycle     | 6–8, 19            | 1     | permission-and-lease; background-and-worker-restart                         | D0/D1 and real camera teardown                          |
| Calibration and frames         | 8–11               | 1–2   | calibration-held-out-validation; mirror-and-frame-epochs; calibration-drift | Independent D4 validation and drift evidence            |
| Eligible target geometry       | 12–13              | 2     | dense-target-acquisition; target-version-and-authorization                  | D0 geometry cases plus D4 acquisition                   |
| Selection/activation grammar   | 5, 14–15, 20       | 2–3   | false-activation-and-rearm; stale-and-reordered-observations                | Deterministic adversarial and physical no-action trials |
| Manipulation/identity recovery | 16–17              | 3     | rotation-and-constraints; two-hand-degeneracy; hand-loss-and-identity-swap  | D0 constraints plus D4 continuity                       |
| Crossdeck transaction seam     | 18                 | 4     | handoff-release-and-ack                                                     | Actual transaction fault proof and D4/D5 ceremony       |
| Input/accessibility            | 21–23              | 2–5   | modality-and-accessibility; relative-mode-fallback                          | Equivalent conventional outcomes and real usability     |
| Privacy/compatibility          | 24–25              | 1–5   | privacy-persistence-and-cleanup; target-version-and-authorization           | Data/export/delete and authored-definition validation   |
| Performance/field experience   | 26–28              | 1–5   | latency-jitter-and-fatigue                                                  | Exact setup, p95 metrics, per-user results and D5       |

All scenario names have the `reach.` prefix in the [registry](../../Spatial_Experience/reach-interaction-registry.json). They remain unregistered. Each future pack must add exact tests, adapters, fixtures, resource policy, evidence artifacts, timeout, cleanup and pending tier gates before execution. The accepted 27-scenario loader baseline is not replaced by these declarations.

## Reference qualification design

Phase 1 selects and records desktop/laptop camera configurations, supported browser/backend versions, normal viewing distance, calibration layout and target angular size. Use held-out targets, repeated trials, randomized order, positive and no-action intervals, left/right hands and realistic camera placements. Include failures in usability outcomes and report training versus validation distributions separately.

Phase 2 freezes the numerical acquisition protocol and measures unsnapped pointing, snapped target success and ambiguity independently. At least 600 no-action opportunities are required for the initial false-activation confidence report. Zero observed failures is not a universal zero-failure claim. Capture-to-visible latency includes observation/inference/dispatch/render stages and instrumentation uncertainty.

Phase 3 adds wraparound, constrained axes, degenerate scale, hand crossing, bystanders, occlusion and reference recovery. Phase 4 uses real owner-domain adapters and acknowledgment/fault behavior. Phase 5 adds field lighting/placement, thermal/resource degradation, comfort/fatigue and assistive input. Optional modes remain explicitly unqualified until their own gates pass.

## Evidence deliverables per implemented phase

Record the implemented scope, exact source identity, requirement/scenario mapping, settings/model/calibration versions, focused automated results, physical tier/setup/provenance, observed distributions, faults/recovery, resource cleanup, unresolved limitations, ordinary Sounding Line decision and landed-tree smoke. Preserve failed attempts and later corrections. Only actual evidence can become a validation or completion record.
