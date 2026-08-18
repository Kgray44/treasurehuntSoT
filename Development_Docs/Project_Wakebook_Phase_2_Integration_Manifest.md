---
title: Project Wakebook Phase 2 Integration Manifest
audience: product-engineering
status: candidate-qualification-in-progress
canonical_for: project-wakebook-phase-2-integration-manifest
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 integration manifest

| Item                    | Current state                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Branch                  | `codex/project-wakebook-phase2-bind-the-voyages`                                    |
| Reconciled main         | `c568e5aa15df4d8b682e328d97fa1a78b7b5760a`                                          |
| Worktree                | task-owned local Companion worktree                                                 |
| Mainline reconciliation | v1.4 authority, Bridgewatch, navigation, and generated control-plane work retained  |
| Reconciliation source   | `c9f899b4cbc40ca9cbcd104991c0477731bf61fa`                                          |
| Legacy evidence         | Preserved only where exact semantic inputs remain unchanged; direct scope rebounded |
| Phase state             | `CANDIDATE_QUALIFICATION_IN_PROGRESS`                                               |
| Protected merge         | Prohibited until frozen-source hosted authority returns `RELEASE_GO`                |

The current-main interval included the accepted generic Sounding Line
`PRODUCT_WITH_VERIFICATION_REGISTRATION` admission repair (PR #205), automatic
project-discovery support, browser-fixture support, and generated governance
updates. It did not modify Wakebook/Wayfarer product source, Phase 2 routes, or
Prisma schema and migrations. Accepted main won outside Wakebook seams; the
generated catalog, registry, impact map, and documentation index were rebuilt,
and Wakebook's Phase 2 contracts and `wakebook-phase2` Chromium mapping were
retained. No Phase 3 work is included.

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
