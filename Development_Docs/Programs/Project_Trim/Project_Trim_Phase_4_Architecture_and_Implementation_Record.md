---
title: Project Trim Phase 4 Architecture and Implementation Record
audience: engineering
status: current
canonical_for: project-trim-phase-4-architecture
last_reviewed: 2026-08-18
---

# Project Trim Phase 4 - Trim the Sails

## Scope and authority

Phase 4 turns the existing context architecture into the default measured workflow. It adds short task contracts, advisory context budgets, privacy-safe telemetry, a versioned accounting estimator, prompt-compaction benchmarks, optional-integration evaluations, rollout/readiness guidance, and regression monitoring. It does not create Project Trim Phase 5, a release authority, a token kill switch, cross-task private transcript retention, or a Bridgewatch delivery dependency.

Current sources and Sounding Line remain authoritative. Packets, budgets, telemetry, benchmarks, worksheets, and estimates are derived engineering metadata. They never emit `RELEASE_GO` and cannot block necessary work.

## Machine-readable contracts

`scripts/agent-context/trim-phase4.mjs` provides the inspectable Phase 4 contract surface; `scripts/agent-context/phase4.schema.json` describes short task contracts, budgets, and telemetry records. The canonical worksheet template is `Project_Trim_Context_Budget_and_Usage_Worksheet.json`.

Short contracts preserve only the project/increment/title, selected execution profile, packet requirement, unique scope, unique non-goals, special authorization when actually needed, deliverables, and current completion authority. The inspection reports prompt bytes, words, coarse token proxy, repeated permanent-rule markers, retained requirements, and a bloat warning. It intentionally has no hard character limit: genuinely complex unique work may still need detail.

Budget states are `WITHIN_TARGET`, `ABOVE_TARGET`, `WARNING`, `EFFICIENCY_REVIEW`, and `UNAVAILABLE`. Narrow work starts at 200k/300k/450k, ordinary implementation at 450k/700k/1.0M, and high-risk integration at 750k/1.1M/1.6M. Large closure uses a comparable baseline; absent a defensible baseline it is explicitly `UNAVAILABLE`. Every output is marked advisory-only and `blocksProgress: false`.

The accounting order is `EXACT -> RECONSTRUCTED -> CALIBRATED_ESTIMATE -> COARSE_ESTIMATE -> UNAVAILABLE`. Exact values retain provenance. Reconstruction retains included and missing surfaces. The calibrated estimator is `project-trim-usage-estimator-1.0`, uses the R1 activity bands, records a point/range/confidence/modifiers/caveats, and never calls an estimate official billing. Unknown is null/`UNAVAILABLE`, never zero.

## Calibration and telemetry

The immutable initial corpus is transcribed from Project Trim v1.0-R1 Appendix I: seven owner-supplied platform-visible goal totals totaling 9,883,558 tokens. It is used only for engineering calibration and held-out residual reporting. Historical exact inputs are not rewritten to fit later models.

Telemetry stores safe identifiers, numeric aggregates, bounded classes, accounting method, evidence quality, acceptance state, and remaining waste class. It rejects secret-like, credential-like, raw-prompt, and transcript-shaped fields. It records Sounding Line as the sole release authority and labels itself nonauthoritative.

## Optional evaluation and rollout

Bridgewatch was evaluated and not adopted. Its existing telemetry receiver is intentionally a private authenticated service-heartbeat seam; pushing generic Project Trim task records into it would introduce a credentialed external delivery path without changing authority or providing a necessary status surface. The repository-native worksheet and records remain the default.

Skills are evaluated as a limited-pilot/progressive-disclosure candidate when platform controls are available: a Skill may consume packets and capsules but cannot duplicate authority. Model/reasoning routing is evaluation-only unless controlled benchmark evidence exists. Architecture, security, concurrency, and migrations retain the strongest validated configuration; ordinary work retains the strong default; no high-risk task is silently downgraded.

Projects classify as `READY`, `PARTIAL`, `LEGACY`, or `SENSITIVE`. New READY tasks use Project Trim by default. PARTIAL tasks use conservative expansion; LEGACY tasks may use larger context pending future mapping; SENSITIVE tasks retain specialized handling. No flag-day migration or historical capsule sweep is required.

`Project_Trim_Rollout_Readiness.json` records the representative Project Trim, Bridgewatch, Project Homeport, and historical-unmapped dispositions. `Project_Trim_Phase_4_Dogfood_Telemetry.json` records the Phase 4 task's safe byte-level evidence and explicitly unavailable goal accounting.

## Regression monitoring

Monitor root bootloader bytes, context-workflow bytes, default packet and prompt-contract size, repeated read/search rates, duplicate permanent rules, budget states, estimator residuals, semantic fallback frequency, and legacy-startup count. Threshold crossings are warnings only; they trigger inspection, never an unsafe stop.

`benchmark-phase4.mjs` produces deterministic six-class prompt-contract comparisons and the held-out calibration report. These fixtures prove retained contract requirements and direct byte/token proxies. They do not claim end-to-end token savings; the governing 40-60% ordinary-task target remains `NOT_YET_DEFENSIBLY_MEASURABLE` until a valid comparable task replay exists.
