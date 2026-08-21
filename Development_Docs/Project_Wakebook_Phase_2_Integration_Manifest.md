---
title: Project Wakebook Phase 2 Integration Manifest
audience: product-engineering
status: authority-rejected-policy-scope
canonical_for: project-wakebook-phase-2-integration-manifest
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 integration manifest

| Item                    | Current state                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Branch                  | `codex/project-wakebook-phase2-bind-the-voyages`                                    |
| Reconciled main         | `70afa7ce9f6a2c77394b96020340c069222d60f9`                                          |
| Worktree                | task-owned local Companion worktree                                                 |
| Mainline reconciliation | Project Trim context tooling and generated control-plane work retained              |
| Reconciliation source   | `5461eb67a4bf10f6cbe7d7bac242884383ebfd17`                                          |
| Legacy evidence         | Preserved only where exact semantic inputs remain unchanged; direct scope rebounded |
| Frozen candidate        | `5a7f3e5752c49bbb9816f6de42e4f28c31743b67`                                          |
| Phase state             | `READY_FOR_V14_MAINLINE_ACCEPTANCE`                                                 |
| Protected merge         | Prohibited: authority run `32160955382` issued no `RELEASE_GO`                      |

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
Authoritative run `32160955382` was dispatched once for prior candidate
`3c4926adf4ade4fb2628d98601a3426171394ac6`, its then-current base, and PR #197. Its
sealed plan expanded under `PROJECT_DISCOVERY_CONSERVATIVE`, did not select
`browser.wakebook`, and Wave 0 failed in non-Wakebook browser suites
(Lanternwake mobile zoom and the missing `TIDEGLASS_PHASE3_TASK_ROOT`). The
finalizer returned `SOUNDING_LINE_FINALIZER_WAVE_0_PREREQUISITES_INVALID`, with
no finalization artifact and no `RELEASE_GO`. This external v1.4 browser-matrix
hold is the sole remaining integration condition. The intervening accepted
Deepwater Phase 5 merge did not touch a Wakebook source, route, Prisma,
Playwright, or test-registration seam, so focused Wakebook evidence remains
applicable to current candidate `5a7f3e5752c49bbb9816f6de42e4f28c31743b67`; a
new authority decision is required only after that shared closure is green.

## Current reconciliation supersession

Protected main `df0360044cf0e0612af8e77751cfd7241c57ae1c` is merged by
pre-record source `d594160c5744333a76495341818f676f2690878f`. Its Fairlead
documentation and Sounding Line registry/planner updates do not change a
Wakebook product seam. The generated documentation index was rebuilt, and the
required Phase 2 capability-impact JSON now has the same narrow Wakebook
impact mapping as its companion records. The resulting exact plan selects
`browser.wakebook`, whose fresh local C: fixture passed 2/2 after 59 raw
migrations; direct contracts pass 36/36.

The historical v1.4 browser-matrix hold is superseded. The active condition is
external Feature Catalog failure FT-036: its Drydock branch
`codex/project-drydock-phase3-run-sea-trials` no longer resolves. Freeze,
authority, protected merge, and owner walkthrough remain prohibited until
accepted mainline repairs that foreign record.

## FT-036 resolution

The FT-036 branch-complete state was stale: Drydock PR #52 was already merged
to protected main. Its fragment is promoted to `MAINLINE`, with obsolete branch
metadata removed, and Feature Catalog validation now passes all 49 entries.
The active Phase 2 state is `CANDIDATE_QUALIFIED_PENDING_FREEZE`; the next
commit freezes the candidate, after which exactly one source-bound Mainline
Decision may be dispatched.

## Authoritative failure hold

Run `32193375787` is the sole authority attempt for candidate
`7abe3da1266fb96d9ffb3008c2c6caf98dcabc06`, base
`df0360044cf0e0612af8e77751cfd7241c57ae1c`, and PR #197. Its trusted Plan
rejected `Development_Docs/Features/branch-complete/project-drydock-phase3.json`
as `ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED` before Wakebook execution.
No `RELEASE_GO`, finalization artifact, protected merge, or owner walkthrough
authority exists. The next action belongs to the accepted Sounding Line policy
or Drydock catalog owner, not a repeated Wakebook authority dispatch.
