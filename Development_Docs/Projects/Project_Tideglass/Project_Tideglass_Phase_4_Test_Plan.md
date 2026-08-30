---
title: Project Tideglass Phase 4 Test Plan
status: ACCEPTED_MAINLINE
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-test-plan
---

# Project Tideglass Phase 4 Test Plan

> Current status: Phase 4 is accepted on protected main through PR #195
> (`d3787ccc3260611580fa44b83ece844c80563cc2`). The table preserves the
> pre-acceptance plan; pending cells are historical rather than current gates.

| Area                          | Required focused evidence                                                                                          | Current state                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Semantic/historical contracts | Current, lossless migrated, unsupported, corrupt, redacted, and cross-Chronicle pairs                              | Incremental coverage in progress                                                                                       |
| Cache/execution               | Exact key isolation, digest corruption rebuild, warm read, local-only truth, deterministic separate-process output | Corruption rebuild covered; remaining work pending                                                                     |
| Admiralty diagnostics         | CSRF, assurance, rate limit, exact target grant, target-account edition authorization, safe DTO                    | Unit/schema coverage in progress                                                                                       |
| Wakebook and Studio           | Exact played anchor, return context, Creator comparison, disclosure                                                | Regression pending                                                                                                     |
| Harborlight and Helm          | Only accepted same-Chronicle/update or edition-selection consumers                                                 | Harborlight exact-release and Helm exact selected-to-recommended preflight covered; Helm is read-only and CAPTAIN_SAFE |
| UI/accessibility              | Desktop, mobile, keyboard, zoom, reduced motion, Axe, failure/no-change/partial states                             | Frozen-candidate browser journey passed, including Helm preflight                                                      |
| Documentation/catalog         | Document index, generated catalog, catalog validation                                                              | Incremental validation required after each record update                                                               |

The authoritative Sounding Line run is reserved for a frozen, owner-reviewed
candidate. It is not a development test runner.
