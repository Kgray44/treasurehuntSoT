---
title: Project Landfall Phase 2 validation record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-validation
last_reviewed: 2026-09-30
---

# Phase 2 validation record

This record tracks the Phase 2 candidate separately from protected integration. The exact candidate, hosted run, merge, and landed smoke are recorded after they occur.

## Local candidate evidence

| Check                           | Observed result                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused and broad unit tests    | Full suite: 396 files and 2,196 tests passed on final source. Focused map/journey/bootstrap/authoring: 4 files and 13 tests passed. Feature Catalog: 9 tests passed.                                                                                                                                |
| Production browser              | Five Chromium Phase 2 scenarios passed on the final production build with a task-owned SQLite database: Creator physical/virtual authoring and field-test staleness; Player visit/history/replay; Captain safe pause; virtual route/reveal without GPS; offline local queue/reconnect exactly once. |
| Production build and TypeScript | Production build and TypeScript passed on final source; 147 static pages generated. Existing Edge-runtime/NFT warnings remain outside this change.                                                                                                                                                  |
| Schema and migrations           | SQLite fresh/upgrade migration rehearsal passed 71 migrations and preserved a legacy draft row. MySQL migration parity was statically verified; no server-backed MySQL deployment was run.                                                                                                          |
| Drydock and documentation       | 29 synthetic Drydock fixtures passed; documentation and Feature Catalog validation passed after the records were indexed. One Voyage architecture validation passed.                                                                                                                                |
| Hosted Sounding Line and merge  | Pending exact candidate and hosted decision. No protected-main closure claimed yet.                                                                                                                                                                                                                 |

The browser uses synthetic accounts, fictional virtual geography, and synthetic physical fixes. It proves application behavior in the isolated test runtime, not actual outdoor GPS quality, public map-tile availability, production MySQL, deployment, or owner acceptance. The browser displayed a network-unavailable map fallback in the local environment; external tiles were not verified. The service worker and tab cache provide a bounded web foundation, not native offline map packages or guaranteed authenticated route reload while disconnected.

An ad hoc run of the four legacy Phase 1 browser scenarios in the Phase 2 runtime stopped before setup: their first scenario expects `/api/dev/validation/database-identity`, which deliberately returned 404 outside the generic Sounding Line isolation profile. The five Phase 2 scenarios in that same run passed. The hosted ordinary run must exercise selected legacy scenarios in its owned validation profile; this ad hoc failure is not counted as a product pass or regression.
