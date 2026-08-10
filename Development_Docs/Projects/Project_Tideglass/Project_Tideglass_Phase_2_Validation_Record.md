---
title: Project Tideglass Phase 2 Validation Record
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-2-validation
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 2 validation record

Status: reconciled candidate validation in progress; this record does not yet claim exact-candidate `RELEASE_GO`, protected-hosted success, integration, or post-merge proof.

## Baseline and isolation

- Worktree: `C:\Users\kkids\Documents\treasurehuntSoT-tideglass-phase2-read-the-wake`
- Branch: `codex/project-tideglass-phase2-read-the-wake`
- Original implementation base: `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`
- Latest reconciled accepted main: `9de00293c73c2d4aea49dc5d2e7a2a4a0515afe1`
- Phase 1 accepted implementation is an ancestor; integrated main receipt: `40d822cd936c9abbfce064fd7799e6a2f8c9785e`.
- Canonical checkout and canonical databases were not mutated. Runtime lease status was empty before validation.

## Completed diagnostics

| Command/evidence                                                | Result                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                        | PASS; 556 task-owned dependencies installed. The package-manager audit reported six existing high-severity advisories; no automatic dependency mutation was authorized.                                                                                                                                                                                     |
| SQLite and MySQL `prisma format`                                | PASS                                                                                                                                                                                                                                                                                                                                                        |
| SQLite and MySQL `prisma validate`                              | PASS for both provider schemas                                                                                                                                                                                                                                                                                                                              |
| `npm run db:generate`                                           | PASS                                                                                                                                                                                                                                                                                                                                                        |
| `npm run db:generate:mysql`                                     | PASS                                                                                                                                                                                                                                                                                                                                                        |
| `npm run typecheck`                                             | PASS after the requirement-audit repairs                                                                                                                                                                                                                                                                                                                    |
| `npx vitest run tests/tideglass --reporter=dot`                 | PASS; 9 files, 91 tests, including all retained Phase 1 cases and completion-audit coverage for idempotency-key conflicts, latest-revision summary digests, withdrawal digests, in-place accessibility regressions, and generic correlation-bound internal API failures                                                                                     |
| `npm run tideglass:migrations:sqlite`                           | PASS; 54 ordered migrations, zero backfill, one synthetic annotation plus one audit event, all other business-table fingerprints preserved, zero foreign-key violations; temporary database removed                                                                                                                                                         |
| `node scripts/tideglass/update-phase2-sounding-line-policy.mjs` | PASS; 11 Tideglass contracts and one owned suite reconciled                                                                                                                                                                                                                                                                                                 |
| `node scripts/sounding-line/test-registry.mjs`                  | PASS after accepted-main reconciliation; 1,846 active governed cases across 48 owned families                                                                                                                                                                                                                                                               |
| `npm run docs:validate`                                         | PASS                                                                                                                                                                                                                                                                                                                                                        |
| `npm run features:sync && npm run features:validate`            | PASS; 43 generated entries                                                                                                                                                                                                                                                                                                                                  |
| `npm run format:check`                                          | PASS                                                                                                                                                                                                                                                                                                                                                        |
| `npm run lint`                                                  | PASS; zero errors and 96 accepted pre-existing warnings outside Tideglass scope                                                                                                                                                                                                                                                                             |
| Pre-reconciliation `npm run test:subsystem`                     | Historical local-source `RELEASE_GO`; 7/7 clean receipts; inventory `3c03bc65d6ae3792371f5c03084fe9ba2e1e4fd590600ecd239779abcfbca247`, plan `48595223d5c4c2be49704fafc537b0e53306e73c2338c0a14451417aea26d9d3`, evidence `485449199f0441eb1397ef0032f647e09e8210ad9ee16014c3dbafac01665b06`; superseded for candidacy by reconciliation with accepted main |

## Current truth boundaries

The passing route tests are local server-contract proof with mocks at canonical authentication/storage ports. They do not prove a deployed runtime or real-account session. SQLite proof is a disposable local migration/upgrade rehearsal. MySQL DDL has provider-parity source plus passing Prisma validation/client generation, but no local MySQL/Docker/WSL provider is available; actual MySQL execution is unavailable and is not claimed. The pre-reconciliation local-source subsystem `RELEASE_GO` is historical focused evidence, not the required exact-commit mainline decision. Exact-candidate Sounding Line, hosted checks, integration, and post-merge parity remain pending.

## Invariance and privacy evidence

Retained Phase 1 tests prove comparison leaves synthetic published rows, TaleSession state, Wayfarer history, and Community release state byte-stable. Phase 2 projection tests prove no story prose, block identity, hidden-count field, Creator-only note, Captain-only semantic path, raw snapshot, storage path, or client-controlled elevation appears outside its governed audience. Authorization tests prove a foreign Creator and a bare administrator label cannot bypass exact Chronicle ownership/collaboration. Annotation API DTOs omit account identity, idempotency, and checksum fields. The SQLite rehearsal proves no guessed annotation backfill and that one annotation mutation changes only the Tideglass annotation and audit tables.
