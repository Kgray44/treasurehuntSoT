---
title: Project Sounding Line Phase 3 Codex Enforcement Design
audience: engineering
status: current
---

# Future Codex enforcement design

A future task must declare behavior/contracts/tests/metadata changes, generate a plan, execute focused evidence, and report selected and omitted suites, reuse/invalidation, roots/blocked nodes, cleanup, debt/external blockers, and governed status wording. Required completion fields are source watermark, policy version, plan ID/digest, changed contracts, selections/omissions/results, reuse/invalidation, roots/blocked nodes, cleanup, remaining debt, final status, and `executionUsage`. Missing plan/cleanup, unexplained omission, invalid status, stale evidence, or a missing usage footer blocks a stronger completion claim. This is a disabled draft outside active instructions; `.agents` is unchanged.

## Execution Usage Footer

Every final report claiming `PROJECT COMPLETE`, `PHASE COMPLETE`, `MAINLINE INTEGRATION COMPLETE`, `MERGE COMPLETE`, `RELEASE COMPLETE`, or `CONVERGENCE COMPLETE` must include elapsed time, input/output/cached/total tokens, tool calls, and usage source. Exact host telemetry is used when available; each unavailable value is rendered as `UNAVAILABLE_FROM_HOST`, never estimated. The section is operational metadata, not validation evidence, and must not contain prompt or secret material. The machine-readable preparation schema is `scripts/sounding-line/preparation/phase3/completion-report.schema.json`; its elapsed value is ISO 8601 duration and its availability map makes partial host telemetry explicit.
