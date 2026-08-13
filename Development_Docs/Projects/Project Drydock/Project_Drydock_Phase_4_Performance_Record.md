---
title: Project Drydock Phase 4 Performance Record
audience: engineering
status: development-current
canonical_for: project-drydock-phase-4-performance
last_reviewed: 2026-08-13
---

# Project Drydock Phase 4 performance record

This is local qualification evidence, not a production capacity claim.

| Scope | Executable evidence | Local budget | Observed status |
| --- | --- | --- | --- |
| Incremental contract validation | `src/drydock/incremental.test.ts` | 230 blocks under 3,000 ms | PASS |
| Deterministic Sea Trial executor | `src/drydock/simulation/performance.test.ts` | 500 bounded replays under 2,000 ms | PASS |
| Creator Studio scale | `src/components/studio/TaleEditor.test.tsx` | representative 100-Passage selection remains usable | PASS |
| Launch Gate browser load | task-owned authenticated local browser fixture | source-bound `NEEDS_REPAIR` rendering at desktop and 390 px | PASS; no horizontal overflow |
| Historical reader guard | `src/chronicle/published-snapshot-security.test.ts` | size, depth, array, and prototype-key bounds | PASS |

The evaluator and simulator retain their hard source, step, state, trace, virtual-time, reader-size, reader-depth, and reader-array bounds. Larger or incomplete analysis remains truthful (`INCOMPLETE_PROOF`/not-ready) rather than silently becoming a pass.

No production database, live provider, private Chronicle, or device benchmark was used. Production capacity and any provider/device latency remain external acceptance evidence.
