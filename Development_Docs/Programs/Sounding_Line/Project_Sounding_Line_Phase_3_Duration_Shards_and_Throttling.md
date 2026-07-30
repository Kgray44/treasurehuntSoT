---
title: Project Sounding Line Phase 3 Duration Shards and Throttling
audience: engineering
status: current
---

# Duration, sharding, and throttling

Historical statistics retain clean comparable durations and output median, percentiles, MAD, EWMA, and a conservative cold-start fallback. Deterministic longest-processing-time shard placement uses stable IDs for ties. The throttle state machine pauses heavy launch under pressure and prioritizes cleanup; it never changes a suite's evidence floor.
