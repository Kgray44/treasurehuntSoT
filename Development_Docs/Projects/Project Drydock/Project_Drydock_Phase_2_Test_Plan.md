---
title: Project Drydock Phase 2 Test Plan
audience: engineering
status: active
canonical_for: project-drydock-phase-2-test-plan
last_reviewed: 2026-08-10
---

# Project Drydock Phase 2 test plan

This plan governs **Sound the Hull** static-analysis evidence. It is not a Phase 3 scenario, simulation, virtual-time, or runtime-fidelity plan.

## Required evidence

| Family                      | Evidence                                                                                                                       | Current status                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Contracts and compatibility | Registry, fixture, migration, and canonicalization checks for all current block types                                          | Executed by `drydock:validate`                                                |
| Graph and control flow      | Entry, reachability, terminal path, SCC, automatic loop, progress, duplicate-edge, orphan-chapter, and cross-chapter mutations | Executed subset; bounded-loop controls remain pending                         |
| State                       | Typed expressions, initialization, invalid writes, constant conditions, unused writes, and explicit proof exhaustion           | Executed subset                                                               |
| Assets and accessibility    | Reference, type, privacy, readiness, image alternative, and provider-fallback mutations                                        | Executed subset; cinematic captions and audio transcript remain pending       |
| Side effects                | Duplicate and looped artifact grants                                                                                           | Executed; completion-outcome duplication remains pending                      |
| Performance                 | Controlled large synthetic Chronicle and explicit state bound                                                                  | Executed                                                                      |
| Studio and repair           | Owner authorization, source-revision-bound preview, normal history apply, undo/redo, autosave, and report projections          | Covered by focused Studio/service tests; requires final Sounding Line receipt |
| Repository gate             | Sounding Line receipt bound to the reconciled exact candidate                                                                  | Pending                                                                       |

The synthetic corpus ledger is the authoritative per-scenario status record. Every successful mutation must declare the expected stable issue codes and run through full static analysis; no test may execute Chronicle runtime behavior or mutate a Tale Session.

## Exit criteria

Phase 2 can enter reconciliation only when every ledger scenario is executed, the static survey remains bounded and fail-closed, safe repairs remain reversible, and a current-source Sounding Line local-change receipt passes. Protected integration remains a separate, later decision.
