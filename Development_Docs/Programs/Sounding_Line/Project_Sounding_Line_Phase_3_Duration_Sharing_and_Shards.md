---
title: Project Sounding Line Phase 3 Duration Sharing and Shards
audience: engineering
status: current
---

# Duration, setup sharing, and deterministic shards

Historical estimates retain count, first-attempt/clean/retry/failure/blocked counts, median/p75/p90/p95/min/max/MAD/EWMA, and cold/warm/browser/resource/fixture profiles. Outliers remain classified rather than discarded. Before minimum samples, a static declared estimate, file count, or conservative stable order is used.

Shards minimize longest predicted wall time while respecting dependencies, serial families, resource capacity, setup locality, and worker capacity. Stable descending estimate then lexical ID tie-breaking produces deterministic assignments and explanations. Dynamic throttling has `NORMAL`, `CONSTRAINED`, `DEGRADED`, `CRITICAL`, and `RECOVERING`; hysteresis prevents oscillation, cleanup is prioritized, and evidence floors never change. OS telemetry is deliberately not implemented.
