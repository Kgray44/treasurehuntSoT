---
title: Project Drydock Phase 3 Performance Record
audience: engineering
status: current
canonical_for: project-drydock-phase-3-performance
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 performance record

The bounded local regression invokes 500 two-step synthetic Scenarios through the production-shared transition planner. The threshold is less than two seconds on the task host. The test covers executor regression only; it is neither a service capacity claim nor a production provider/device benchmark.

```powershell
npx vitest run src/drydock/simulation/performance.test.ts
```

The executor also has explicit Scenario max-step, max-state, max-trace, and max-virtual-time limits. Crossing a limit returns `INCOMPLETE_PROOF`; it never retries indefinitely or upgrades an unfinished exploration to a pass.
