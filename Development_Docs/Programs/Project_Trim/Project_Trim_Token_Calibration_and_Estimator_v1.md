---
title: Project Trim Token Calibration and Estimator v1
audience: engineering
status: current
canonical_for: project-trim-token-calibration-v1
last_reviewed: 2026-08-14
---

# Project Trim token calibration and estimator v1

Estimator version `project-trim-r1-bands-1.0` preserves the R1 calibration corpus: seven exact Codex goal totals totaling 9,883,558 tokens. Exact exposed totals are retained as `EXACT`. When exact accounting is absent, the Phase 1 estimator uses activity metadata plus duration: `DENSE_CONTINUATION` 21.5k tokens/minute, `MIXED_ENGINEERING` 9.0k, and `WAIT_MONITOR_HEAVY` 6.0k, with deliberately wide ranges and recorded confidence/modifiers.

`CALIBRATED_ESTIMATE` is explicitly not official billing. If duration or equivalent safe metadata is insufficient, the record is `UNAVAILABLE` with null totals; missing accounting is never written as zero. `RECONSTRUCTED` and `COARSE_ESTIMATE` remain reserved states for later evidence adapters.
