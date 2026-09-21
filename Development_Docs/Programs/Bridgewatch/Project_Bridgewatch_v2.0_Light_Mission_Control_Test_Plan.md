---
title: Project Bridgewatch v2.0 Light Mission Control Test Plan
audience: engineering
status: active-implementation
canonical_for: project-bridgewatch-v2-light-mission-control-test-plan
last_reviewed: 2026-08-27
---

# Project Bridgewatch v2.0 — Light Mission Control Test Plan

| ID             | Scope                              | Proof                                       | Pass condition                                                                                                                                                           |
| -------------- | ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BWV2-ATTENTION | Source-bound operator intelligence | `operator-attention.test.ts`                | Source, coverage, PR, candidate, verification, runtime, and provider conditions retain a code, explanation, and source reference.                                        |
| BWV2-UI        | Mission station hierarchy          | `mission-control-ui.test.ts`                | Eleven stations, deep links, searchable collections, profile intelligence, focus, mobile, and reduced-motion contracts remain present.                                   |
| BWV2-SOURCE    | P2 fabric and source states        | Fabric and server tests                     | Provenance, redaction, current-main fallback, unavailable/degraded states, and GET-only observation routes remain correct.                                               |
| BWV2-PROFILE   | Dense project profile              | Server route and browser acceptance         | Phases, versions, branch/PR association, candidate/main detail, verification, workers, provenance, and history remain grouped and never fabricated.                      |
| BWV2-GATEWAY   | Voyagewright mount contract        | `src/admiralty/bridgewatch-gateway.test.ts` | The capability-gated gateway exposes only intended read-only dashboard paths.                                                                                            |
| BWV2-LIVE      | Task-owned real local stack        | Loopback HTTP and browser                   | Actual repository discovery, local runtime state, degraded GitHub, unconfigured provider/reporting, stations, source coverage, and project navigation render truthfully. |
| BWV2-A11Y      | Desktop/mobile interaction         | Browser and static accessibility checks     | Keyboard-visible controls, labelled input fields, semantic tables, responsive wrapping, and no critical/serious automated accessibility violations.                      |

The final candidate uses one current-main reconciliation and one candidate-bound
Sounding Line decision. Test output is diagnostic until the authoritative final
decision and protected binding are complete.
