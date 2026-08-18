---
title: Project Wakebook Phase 2 Integration Manifest
audience: product-engineering
status: candidate-qualified-pending-authority
canonical_for: project-wakebook-phase-2-integration-manifest
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 integration manifest

| Item                    | Current state                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Branch                  | `codex/project-wakebook-phase2-bind-the-voyages`                                    |
| Reconciled main         | `a6c1f441d3628bd828bd7a1c3cd77d419a0701c6`                                          |
| Worktree                | task-owned local Companion worktree                                                 |
| Mainline reconciliation | Project Trim context tooling and generated control-plane work retained              |
| Reconciliation source   | `5461eb67a4bf10f6cbe7d7bac242884383ebfd17`                                          |
| Legacy evidence         | Preserved only where exact semantic inputs remain unchanged; direct scope rebounded |
| Phase state             | `CANDIDATE_QUALIFIED_PENDING_MAINLINE_DECISION`                                     |
| Protected merge         | Prohibited until frozen-source hosted authority returns `RELEASE_GO`                |

The current-main interval added accepted Project Trim context tooling and its
generated catalog, registry, and documentation-index updates. It did not modify
Wakebook/Wayfarer product source, Phase 2 routes, Prisma schema and migrations,
or the `wakebook-phase2` Chromium mapping. Accepted main won outside Wakebook
seams; generated control-plane artifacts were regenerated. No Phase 3 work is
included in this branch.

The exact focused hosted suite is `browser.wakebook`, with the
`wakebook-phase2` Playwright project. PR #205 resolved the earlier
verification-registration rejection: a read-only classification of preserved
PR #197 now returns `PRODUCT_WITH_VERIFICATION_REGISTRATION`, owner
`project-wakebook`, with zero errors. Focused hosted dispatch `32153529083`
against reconciliation source `e7acab5dc8e415b30e571ebf696d85ef63fdb587`
ended as GitHub `startup_failure` before it created a job, worker, or browser
receipt. It is infrastructure evidence only. The remaining source-bound
browser proof and `RELEASE_GO` must come from one final v1.4 candidate
Mainline Decision after all pre-authority qualification is frozen.

Authority run `32154971683` was dispatched against the now-superseded
pre-reconciliation candidate `230ab82b46d663558c9831fcbc48e2af8f50de2b` and
base `c568e5aa15df4d8b682e328d97fa1a78b7b5760a`. Its plan fell back
conservatively because `Development_Docs/Features/catalog/wakebook.json`,
`playwright.config.ts`, and `scripts/features/feature-catalog.test.ts` were
unmapped, expanding into unrelated suites. It is not a Wakebook browser receipt
and cannot authorize this reconciled candidate.

The resulting test-fixture repair source
`ecc3f9841980e9cb389a95d8ab83ab6fa8d5b940` passed the unmodified
`wakebook-phase2` Playwright project locally: 2/2 Chromium journeys on a fresh
task-owned C: SQLite database. Prisma `migrate deploy` still emits a blank
schema-engine error, but Prisma's supported `db execute` applied each of the
59 checked-in migration SQL files to that database; the scenario then created
only its own synthetic accounts and Voyage data. The prior hosted startup
failures remain infrastructure history, not a substitute for this local proof.
The frozen candidate still requires one source-bound v1.4 Mainline Decision and
`RELEASE_GO` before protected merge.
