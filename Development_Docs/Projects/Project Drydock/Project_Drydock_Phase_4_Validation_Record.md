---
title: Project Drydock Phase 4 Validation Record
audience: engineering
status: v1.4-reconciled-qualification
canonical_for: project-drydock-phase-4-validation
last_reviewed: 2026-08-18
---

# Project Drydock Phase 4 validation record

This record is development and local-qualification evidence only. It is not a Sounding Line release decision or protected-main acceptance receipt.

| Evidence | Result | Boundary |
| --- | --- | --- |
| `npm run drydock:test` | PASS - 43 files, 222 tests | Drydock unit and contract regression after current protected-main reconciliation |
| `npm run drydock:readiness` | PASS - 3 files, 10 tests | canonical readiness, required-suite policy, and publishing evidence |
| `npm run drydock:publishing-contract` | PASS - 5 files, 11 tests | owner-safe APIs, immutable evidence, and same-source race fallback |
| `npm run drydock:historical` | PASS - 4 files, 9 tests | corpus/upcast and historical-reader security |
| `npm run drydock:sea-trials` | PASS - 14 files, 34 tests | bounded simulation and persisted Scenario Suite behavior |
| `npm run drydock:harborlight` | PASS - 3 files, 6 tests | adapter-only Community publication integration |
| `npm run drydock:phase4:migrations:sqlite` | PASS - 62 migrations | additive tables, source-idempotency index, representative Phase 3 Suite preservation; MySQL remains static SQL parity only |
| `npm run drydock:validate` | PASS | generated authoring/rule artifacts and fixtures |
| `npm run test:policy` | PASS - 476 contracts, 63 suites, no errors | current Sounding Line v1.4 policy |
| `npm run docs:validate` and `npm run features:validate` | PASS | governed documentation and generated Feature Catalog |
| `npm run lint` | PASS - 110 inherited warnings, zero errors | generated task-owned Next browser output is narrowly ignored |
| `npm run test:raw:build` | PASS | non-authoritative production build; one unrelated Community/Sealed Hold tracing warning remained non-failing |
| `npm run drydock:browser` | PASS - 1 Chromium journey | task-owned SQLite migration rehearsal, authenticated Studio creation, Launch Gate, Compatibility, Sea Trials, 390 px keyboard behavior, and zero serious/critical Axe findings |

The frozen source checkpoint `896817e315e5e4300569e996281da2f3601bd3d8` remains preserved historic evidence. After reconciliation to protected main `8c7c3589955f94fcc8a400a81e4f61565d0d4521`, the current branch reran the focused Drydock, publishing, historical, Sea Trials, Harborlight, Studio, migration, policy, and authenticated browser families. The browser journey additionally proves an emulated reduced-motion preference alongside the existing 390 px, keyboard, and Axe checks.

The local phase is `READY_FOR_V14_MAINLINE_ACCEPTANCE`: its exact frozen candidate still requires a current Sounding Line Mainline Decision with a valid `RELEASE_GO` and protected integration before it can be called accepted. Live MySQL and connected external/provider proof remain distinct external evidence and are not represented as passed.
