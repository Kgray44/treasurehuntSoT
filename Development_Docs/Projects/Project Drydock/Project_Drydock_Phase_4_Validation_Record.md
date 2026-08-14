---
title: Project Drydock Phase 4 Validation Record
audience: engineering
status: v1.4-reconciled-qualification
canonical_for: project-drydock-phase-4-validation
last_reviewed: 2026-08-14
---

# Project Drydock Phase 4 validation record

This record is development and local-qualification evidence only. It is not a Sounding Line release decision or protected-main acceptance receipt.

| Evidence | Result | Boundary |
| --- | --- | --- |
| `npm run drydock:test` | PASS - 43 files, 219 tests | Drydock unit and contract regression after v1.4 reconciliation |
| `npm run drydock:readiness` | PASS - 3 files, 10 tests | canonical readiness, required-suite policy, and publishing evidence |
| `npm run drydock:publishing-contract` | PASS - 5 files, 11 tests | owner-safe APIs, immutable evidence, and same-source race fallback |
| `npm run drydock:historical` | PASS - 4 files, 9 tests | corpus/upcast and historical-reader security |
| `npm run drydock:sea-trials` | PASS - 14 files, 34 tests | bounded simulation and persisted Scenario Suite behavior |
| `npm run drydock:harborlight` | PASS - 3 files, 6 tests | adapter-only Community publication integration |
| `npm run drydock:phase4:migrations:sqlite` | PASS - 62 migrations | additive tables, source-idempotency index, representative Phase 3 Suite preservation; MySQL remains static SQL parity only |
| `npm run drydock:validate` | PASS | generated authoring/rule artifacts and fixtures |
| `npm run test:policy` | PASS - 475 contracts, 61 suites, no errors | current Sounding Line v1.4 policy |
| `npm run docs:validate` and `npm run features:validate` | PASS | governed documentation and generated Feature Catalog |
| `npm run lint` | PASS - 102 inherited warnings, zero errors | generated task-owned Next browser output is narrowly ignored |
| `npm run test:raw:build` | PASS | non-authoritative production build; one unrelated Community/Sealed Hold tracing warning remained non-failing |
| `npm run drydock:browser` | PASS - 1 Chromium journey | task-owned SQLite migration rehearsal, authenticated Studio creation, Launch Gate, Compatibility, Sea Trials, 390 px keyboard behavior, and zero serious/critical Axe findings |

Current local qualification still requires one frozen-candidate rebound after these records and generator outputs are finalized. The v1.4 post-cutover browser-fixture closure, live MySQL, and connected external/provider proof remain separate external conditions and are not represented as passed.
