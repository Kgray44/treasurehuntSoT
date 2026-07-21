# Project Wayfarer Phase 1 Validation Record

Status: **NO-GO / incomplete** as of 2026-07-21.

## Successful evidence

| Command                                                    | Environment                                                                      | Result                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Prisma format and validate, SQLite schema                  | local bundled Prisma against Phase 1 worktree                                    | passed                                                                                                  |
| Prisma validate, MySQL schema with a syntactic MySQL URL   | local bundled Prisma against Phase 1 worktree                                    | passed                                                                                                  |
| `scripts/test-all.ps1 -SkipBrowserInstall` migration setup | `%LOCALAPPDATA%\ForeverTreasureCompanion\validation`, disposable `validation.db` | six migrations, including `20260721120000_wayfarer_unified_identity`, applied successfully; seed passed |
| `git diff --check`                                         | Phase 1 worktree                                                                 | passed                                                                                                  |

## Blocking validation failures

1. The first full-gate attempt installed production-only dependencies and failed before validation because `@prisma/engines` was absent.
2. After dependency repair, the full gate again applied all migrations but stopped on four pre-existing formatting failures: `Development_Docs/Animation_System_Full_Audit.md`, `Development_Docs/Animation_System_Test_Plan.md`, `Development_Docs/Project_One_Voyage_Architecture_Inventory.md`, and `Development_Docs/Project_One_Voyage_Canonical_Domain_ADR.md`. They are outside Phase 1 ownership and were not edited.
3. The validation mirror then lacked `esbuild`, preventing `tsx` helpers from running. A local package-manager repair was attempted, but Prisma client generation hit Windows `EPERM` while replacing `query_engine-windows.dll.node`. No unit, integration, browser, build, lint, or typecheck result may be called a pass.

## Integrity statement

The migration rehearsal used the isolated validation database. The full harness's canonical-database final verification could not complete because its helper could not run after the `tsx` dependency failure; therefore canonical database non-mutation is not fully proven by the final gate in this run.

## Required next validation

Repair the validation runtime with a normal npm 11 development-dependency installation, ensure Prisma generation can replace its engine DLL, preserve the unrelated formatting files, run focused Wayfarer tests, then run `scripts/test-all.ps1 -SkipBrowserInstall` once from a stable validation runtime.
