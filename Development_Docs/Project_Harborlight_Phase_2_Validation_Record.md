# Harborlight Phase 2 Validation Record

Environment: isolated local worktree `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\harborlight-phase2-complete-convergence`, with a disposable SQLite rehearsal database and the local development dependency runtime.

## Convergence validation (2026-07-22)

| Command / gate                                              | Result                                             |
| ----------------------------------------------------------- | -------------------------------------------------- |
| Ordered SQLite migration rehearsal through `20260722145000` | passed; 101 tables; `PRAGMA foreign_key_check` = 0 |
| `prisma validate` SQLite and MySQL schema                   | passed with disposable URLs                        |
| Focused Exchange, artifact, and accessible-surface Vitest   | passed; 4 files, 17 tests                          |
| Full Vitest                                                 | passed; 110 files, 931 tests                       |
| `tsc --noEmit`                                              | passed                                             |
| Focused ESLint                                              | passed; 0 errors, 1 new `img` optimization warning |
| Product-language validation                                 | passed                                             |
| `next build --webpack`                                      | passed                                             |

Live MySQL migration execution, production scanner/object-storage/worker deployment, and browser acceptance are explicitly external staging/deployment proofs and have not been counted as passing.

## Studio route completion attempt (2026-07-24)

`/studio/exchange` and the Studio-library Exchange navigation were added, with focused component coverage for publication requirements, installation modes, reduced-motion fallback, and no fabricated success receipt. Focused Vitest passed: 5 files / 18 tests. TypeScript and Webpack production build passed; the built route inventory includes `/studio/exchange`.

Dedicated task-owned browser acceptance remains unrun in this attempt. It is not counted as passed.

| Command / gate                                                                                         | Result                                  |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `prisma format --schema prisma/schema.sqlite.prisma` and MySQL schema                                  | passed                                  |
| `prisma validate` for SQLite and MySQL with disposable URL values                                      | passed                                  |
| ordered direct SQLite SQL rehearsal, 18 migrations, `PRAGMA foreign_key_check`                         | passed; 0 violations                    |
| `vitest run src/community/domain.test.ts src/community/package.test.ts src/community/exchange.test.ts` | passed; 3 files, 12 tests               |
| `vitest run`                                                                                           | passed; 94 files, 868 tests             |
| `tsc --noEmit`                                                                                         | passed                                  |
| `eslint .`                                                                                             | passed; 23 inherited warnings, 0 errors |
| `tsx scripts/validate-user-facing-language.ts`                                                         | passed                                  |
| `next build --webpack`                                                                                 | passed                                  |

The full repository suite, production build, browser E2E, live MySQL migration, production scanner/object storage and durable worker checks are not production proof. The inherited missing Lanternwake Rive asset gate remains a separate release blocker and does not alter Harborlight's focused results.

## Isolated browser-harness repair attempt (2026-07-24)

The dedicated worktree deliberately has no `prisma/dev.db`. `scripts/test-all.ps1`
now accepts an explicit absolute `-BaselineDatabasePath`, fingerprints the
baseline SQLite family before and after validation, records `baselineSource` in
the isolation receipt, and creates the migrated seed plus nonce-bearing mutation
copy only beneath the task-owned validation runtime. It also provides an opt-in
`-BrowserOnly -BrowserTestPath` mode for a focused phase journey without
replacing the ordinary full repository gate.

The supplied external baseline was
`C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\development\prisma\dev.db`.
Its preflight and post-attempt SHA-256 were both
`a05a9b06ef2abc747a22d843945299f916800bc5e4962f17b59e13024a06593f`
(905216 bytes; `2026-07-21T13:29:34.790Z`). The worktree-local
`prisma/dev.db` was not created, and the harness left ports 3100 and 3200
unowned after each attempt.

The focused Harborlight Chromium journey was added and lists from the runtime
as one Chromium mutation test plus the repository's required read-only setup;
the WebKit project reports its expected skip. Two initial harness runs ended
before browser mutation because the focused path was translated incorrectly
from the source worktree to the runtime mirror. Those defects were repaired.
The next run could not start because another independently-owned
`validation-runtime.lock` holder was actively executing a different focused
validation. Per the single-owner isolation rule, it was not terminated or
shared. Therefore there is no completed Harborlight browser pass/fail/skip
total, restart proof, or final-gate result yet.

PROJECT HARBORLIGHT PHASE 2 BLOCKED
