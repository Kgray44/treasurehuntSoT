# Phase 3 Timing Metric Catalog

`WAYFARER_TIMING_V1` defines wall-clock seconds as `completedAt - startedAt`
when both canonical timestamps exist and the result is non-negative; accuracy
is `EXACT`. Active, paused, connected, interactive, and Captain-wait values
remain `UNAVAILABLE` until canonical evidence supports a deterministic formula.
No unavailable metric is serialized as zero.
