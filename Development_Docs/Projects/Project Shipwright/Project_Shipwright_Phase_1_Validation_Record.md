---
title: Project Shipwright Phase 1 Validation Record
audience: engineering
status: accepted-mainline
canonical_for: project-shipwright-phase-1-validation
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 1 Validation Record

## Evidence status

This record distinguishes supporting focused evidence from the authoritative exact-head mainline decision. The authoritative decision below is the sole release decision for this acceptance repair.

| Check                                                  | Result                        | Evidence / limitation                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused Studio/shell/journal/motion suite              | PASS                          | 27 tests passed: `TaleEditor`, `ProductShell`, `PhysicalJournalBook`, and the finite Shipwright motion vocabulary, using Vitest 4.1.10 and the local completed dependency cache.                                                                                                                                                                                                           |
| Existing Studio behavior                               | PASS within focused suite     | Existing More disclosure, dnd/motion ownership, inspector focus, validation focus, failed-save deletion, publication state, autosave/publish, and upload tests passed.                                                                                                                                                                                                                     |
| Whole-card movement, selection, and animation controls | PASS                          | Focused coverage proves sortable card wiring, additive selection, and all three persisted animation controls with the finite preset list.                                                                                                                                                                                                                                                  |
| Validation presentation                                | PASS                          | Focused coverage proves a blocking issue opens the affected Passage, closes, and can be reopened from the persistent top status.                                                                                                                                                                                                                                                           |
| Command palette                                        | PASS                          | Tests cover available canonical actions, absence of invented block action, modal search focus, Escape close, focus restoration, and Ctrl+K opening.                                                                                                                                                                                                                                        |
| Canvas view foundation                                 | PASS                          | Test covers the keyboard-reachable zoom control and local 100% to 110% state without changing an existing Passage.                                                                                                                                                                                                                                                                         |
| TypeScript                                             | INHERITED ENVIRONMENT BLOCKER | `tsc --noEmit` reaches only two existing unrelated unresolved optional provider imports: `src/wayfarer/transactional-email.ts` cannot resolve `postmark` and `resend`. No diagnostic names a changed Shipwright file. This is not treated as a pass or as a Shipwright defect.                                                                                                             |
| Focused Helm browser family                            | PASS                          | Exact governed `browser.helm` replay passed 2/2 in a task-owned isolated runtime with `CLEAN` teardown after restoring the lockfile-matched local dependencies and using `prisma/sounding-line-baseline.db`. This is supporting evidence only.                                                                                                                                             |
| Full registered suite/finalizer                        | PASS                          | Explicit hosted **Sounding Line authoritative** workflow run `31568707098` finalized `RELEASE_GO` for exact source `d7f3d0a2c9889134919402b8338f9df5095c657f`. It produced 37 sealed, passing, clean receipts under plan digest `84d5ea51cd6301b95409b11aa4884914ebc0ebc068a1f0fce830c43dbf38aaef` and evidence digest `b7dbe23b6a9d55af528323a03ab3f8d2dd4ea7f213d8855b616f3bc9558df07b`. |
| Browser/responsive/accessibility matrix                | GOVERNED PASS                 | The authoritative matrix included the registered browser families, including `browser.helm`; it is release evidence. The owner did not request a second post-correction walkthrough, so no post-correction visual walkthrough is fabricated.                                                                                                                                               |

## Runtime provenance

The repository lives on a UNC share, which causes Vitest worker/module-resolution failure when invoked from its UNC dependency tree. Focused evidence used the task worktree at `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-shipwright-phase1-v2`, the bundled Node runtime, and a local existing dependency cache. This is a diagnostic execution arrangement only; it does not alter package lockfiles or package-manager authority.

## Formal Phase 1 acceptance

| Acceptance field                           | Truthful status                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation                             | `COMPLETE`                                                                                                                                                                    |
| Focused validation                         | `COMPLETE`                                                                                                                                                                    |
| Owner review                               | `OWNER_ACCEPTED_WITH_POST_REVIEW_CORRECTIONS`                                                                                                                                 |
| Post-correction repeat walkthrough         | `WAIVED_BY_OWNER`                                                                                                                                                             |
| Owner walkthrough gate                     | `SATISFIED_BY_PRIOR_REVIEW_PLUS_EXPLICIT_WAIVER`                                                                                                                              |
| Mainline Safety Contract                   | `PASS`                                                                                                                                                                        |
| Sounding Line exact-head mainline decision | `RELEASE_GO` — run `31568707098`, exact source `d7f3d0a2c9889134919402b8338f9df5095c657f`, evidence digest `b7dbe23b6a9d55af528323a03ab3f8d2dd4ea7f213d8855b616f3bc9558df07b` |
| Physical presence on `origin/main`         | `CONFIRMED` by the protected integration of PR #48; the resulting remote main SHA is the post-merge integration identity.                                                     |
| Formal mainline acceptance                 | `ACCEPTED_MAINLINE`                                                                                                                                                           |
| Product acceptance                         | `ACCEPTED` based on prior owner review plus the explicit repeat-walkthrough waiver                                                                                            |
| Shipwright Phase 2 dependency              | `DRYDOCK_P1_ACCEPTED = true`; `f07fbb693e32f6b1069870fae9da668ed3392d4b` is an ancestor of the accepted candidate.                                                            |

## Closeout boundary

Shipwright Phase 1 is complete once its protected integration is present on `origin/main`. No Shipwright Phase 2 work is authorized or started by this repair.
