---
title: Project Sounding Line Phase 4 Cutover and Rollback Plan
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-cutover-rollback
last_reviewed: 2026-07-29
---

# Phase 4 Cutover and Rollback Plan

## Staged authority

| Stage                                             | Prerequisite and enabled surface               | Authority and observation                                        | Abort / rollback                              |
| ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `STAGE_0_LEGACY_AUTHORITATIVE`                    | current baseline; legacy harness only          | legacy authoritative                                             | n/a                                           |
| `STAGE_1_SHADOW_PLANNING`                         | accepted plan policy; no execution             | legacy authoritative; inspect deterministic plans                | plan mismatch -> Stage 0                      |
| `STAGE_2_SHADOW_EXECUTION`                        | isolated local runtime and cleanup proof       | legacy authoritative; non-release shadow nodes                   | collision/cleanup defect -> Stage 0           |
| `STAGE_3_DUAL_RUN_FOCUSED`                        | focused parity criteria                        | legacy authoritative; required focused window                    | any unacceptable difference -> Stage 0        |
| `STAGE_4_DUAL_RUN_RELEASE`                        | broad parity and external-gate rules           | legacy authoritative; release-shaped window                      | veto, drift, or incomplete cleanup -> Stage 0 |
| `STAGE_5_SOUNDING_LINE_PRIMARY_LEGACY_FALLBACK`   | accepted dual-run evidence and security review | Sounding Line primary only under approved scope; legacy fallback | fallback immediately; investigate             |
| `STAGE_6_SOUNDING_LINE_AUTHORITATIVE_OBSERVATION` | Stage 5 stable for required window             | Sounding Line authoritative with legacy retained                 | revert authority to legacy                    |
| `STAGE_7_LEGACY_RETIRED_ROLLBACK_RETAINED`        | explicit closure acceptance                    | legacy execution retired; rollback material retained             | restore governed fallback                     |

No stage jump is permitted because one run passed. Each advancement needs the
previous stage's retained evidence, named authorization, observation window,
and verified rollback. This preparation does not enable any stage beyond 0.

## Rollback and emergency serial mode

Rollback scenarios include bad planner, missing tests, worker compromise,
cleanup regression, evidence corruption, CI outage, distributed-broker defect,
incorrect decision, performance collapse, and provider mismatch. The future
activation authority is the release incident owner plus required security/release
review. The future activation command is a governed, audited `emergency-serial`
operation that selects the legacy harness scope; it is intentionally not
implemented or executable here.

Activation records trigger, source/policy identity, scope, affected receipts,
operator, time, and evidence impact. It stops distributed dispatch, preserves
partial evidence, and runs only the approved serial path. Restoration requires
root cause repair, security review where applicable, cleanup verification,
fresh parity evidence, and explicit authority. Emergency serial remains
available through closure observation; no legacy command or compatibility is
removed in preparation.
