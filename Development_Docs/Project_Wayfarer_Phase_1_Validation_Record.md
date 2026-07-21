# Project Wayfarer Phase 1 Validation Record

Status: **implementation candidate; repository-wide acceptance not complete** as of 2026-07-21.

## Successful evidence

| Command                                                    | Environment                                                                      | Result                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Prisma format and validate, SQLite schema                  | local bundled Prisma against Phase 1 worktree                                    | passed                                                                                                  |
| Prisma validate, MySQL schema with a syntactic MySQL URL   | local bundled Prisma against Phase 1 worktree                                    | passed                                                                                                  |
| Prisma generate and migration deploy                | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\wayfarer-phase1`, disposable `wayfarer-validation.db` | six migrations, including `20260721120000_wayfarer_unified_identity`, applied successfully |
| TypeScript typecheck                                | dedicated Wayfarer runtime                                                        | passed |
| `vitest run`                                        | dedicated Wayfarer runtime                                                        | 85 files and 904 tests passed |
| focused `AnimationShowcase.test.tsx`                 | dedicated Wayfarer runtime                                                        | 9 tests passed |
| `git diff --check`                                         | Phase 1 worktree                                                                 | passed                                                                                                  |

## Acceptance limitations

1. The contaminated shared validation mirror was not used for final evidence. The dedicated Wayfarer runtime was installed from the committed manifests and used for the focused checks above.
2. The required purpose-built Wayfarer lifecycle, reconciliation, authorization, privacy, CSRF, rate-limit, and browser-journey suites have not yet been added and run as discrete acceptance evidence.
3. No clean, complete invocation of `scripts/test-all.ps1 -SkipBrowserInstall` was captured from the dedicated runtime; therefore format, lint, build, browser, and repository-wide release validation are not passes.

## Integrity statement

The migration rehearsal used the isolated `wayfarer-validation.db`. The canonical checkout was not used for this branch's generation, migration, or test commands. Repository-wide canonical-database non-mutation remains unproven because the full harness has not completed from the dedicated runtime.

## Required next validation

Add and run the missing purpose-built Wayfarer acceptance suites, then run `scripts/test-all.ps1 -SkipBrowserInstall` once from the dedicated runtime. Do not label this branch accepted for integration until those checks are green.
