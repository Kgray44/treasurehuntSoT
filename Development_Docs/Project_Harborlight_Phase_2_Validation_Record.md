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

The first exclusive Harborlight browser attempt subsequently reached the
task-owned server and Playwright, but the generic Chromium project executed a
Phase 3 read-only setup dependency first. That unrelated setup failed its
Captain login with HTTP 500, so the Harborlight test never began and the
isolation receipt correctly rejected the absence of an expected browser
mutation. The harness was narrowed again to an independent
`harborlight-phase2` Chromium project. Before the corrected run could acquire
the global validation lock, a separate Phase 3 validation task reacquired it
and owns port 3100. It has not been interrupted. Browser acceptance, restart,
and final Phase 2 validation remain pending exclusive runtime ownership.

After the runtime was released, the dedicated `harborlight-phase2` project ran
through the repaired harness successfully. The run used the explicit external
baseline above, created
`validation-isolated-20260724-100904465-6adb6e9282d44a8bab65fa0f3c37d499.db`,
and proved nonce `6522cd57ebfb828d3ae06b83c193eb3444611077ceebfa8e6f97ac8c30cce2f2`
through the application on owned server PID `31004` / port `3100`. Playwright
reported 1 passed in 24.5 seconds. The isolated copy showed the expected
`platformAuditEvent` mutation; the external baseline family remained unchanged
and ports 3100/3200 were released afterward. The synthetic Creator fixture was
corrected to include the canonical PlayerProfile required by Community
authorization. Focused Harborlight Vitest passed (5 files / 18 tests), and
`next build --webpack` passed with `/studio/exchange` in the route inventory.

This is a valid Studio/Exchange smoke journey, not the full Phase 2 browser
acceptance matrix. It does not yet cover the required 2D and 3D artifact
publication flows, second-Creator install review, fork/lineage, forced rollback
cases, active-session pinning, or restart persistence. Those absent terminal
proofs are the remaining Phase 2 blocker.

## Isolated binary and finalization continuation (2026-07-24)

The Exchange now obtains binary evidence from a provider seam. The ordinary
provider returns `SCAN_NOT_CONFIGURED` and binary publication remains denied.
The only alternative is `synthetic-test`, which requires the harness-selected
provider, `NODE_ENV=test` (or the private nonce-bound harness bridge), an
isolated validation database, and a valid run nonce. It recognizes exactly two
compiled repository-owned fixtures by SHA-256, byte length, media type, magic
bytes, and the existing PNG/GLB validators. It is not a malware scanner and
does not provide assurance for arbitrary uploads.

| Gate                                                               | Result                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| scanner/package/install focused Vitest                             | passed; 3 files / 13 tests                                                                                                                        |
| scanner provider checks in full Vitest                             | passed; 112 files / 937 tests                                                                                                                     |
| H1-H8 compact Chromium matrix                                      | passed; 3 tests / 0 failed / 0 skipped, 23.1 seconds (`run-20260724-1218`)                                                                        |
| H4 trusted second-Creator review                                   | passed; persisted creator/listing/release/schema/license/attribution/inventory/compatibility/accessibility/performance/rights/script-safety facts |
| H6 fork and lineage                                                | passed; transactional fork listing/release/lineage, source identity and attribution retained                                                      |
| H7 rollback/idempotency                                            | passed; failed finalization creates no mappings or installation, retry commits exactly once                                                       |
| H8 active-session non-mutation                                     | passed; pinned version, sequence, variables, inventory and event count unchanged by install/fork                                                  |
| formatting / TypeScript                                            | passed                                                                                                                                            |
| production `next build --webpack` and `/studio/exchange` inventory | passed                                                                                                                                            |
| external baseline family                                           | unchanged: `a05a9b06ef2abc747a22d843945299f916800bc5e4962f17b59e13024a06593f`, 905216 bytes, `2026-07-21T13:29:34.790Z`                           |
| worktree `prisma/dev.db`, ports, lock                              | absent; 3100/3200 released; lock released                                                                                                         |

The earlier Rive dependency was resolved from the repository's authored asset
history, not by accepting the incomplete owner-provided download revisions.
Commit `a23437d910f910acf96b9041220cfbce0b7573c4` carries the four governed
source/export pairs, their manifest and provenance, runtime contract support,
and validator coverage. The focused gate passed: all four binaries load with
their required artboards and either their frozen ViewModel or legacy
state-machine-input contract; their local fallback and production paths are
also validated.

The final governed Harborlight run was
`run-20260724-1500-harborlight-final`. It selected only
`tests/e2e/harborlight-phase2.spec.ts` with the `harborlight-phase2` project;
the harness therefore skips the unrelated generic Phase 3
`CHAPTER_PREPARED` assertion while retaining the isolated database proof,
production build, and two controlled production starts.

| Final gate                                                               | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PowerShell syntax / Prettier / lint / TypeScript / product-language      | passed (lint: 0 errors, 63 existing warnings)                                                                                                                              |
| full Vitest                                                              | 112 files / 939 tests passed                                                                                                                                               |
| animation-asset validation                                               | passed: 4 Rive binaries, 4 governed sources, 3 Lottie assets, local SVG fallbacks                                                                                          |
| H1-H8 Chromium acceptance                                                | 3 passed / 0 failed / 0 skipped, 1 worker, 22.4 seconds                                                                                                                    |
| isolated database and nonce path                                         | passed through the owned application server                                                                                                                                |
| package, checksum, install, rollback, authorization and privacy evidence | included in the passing full Vitest stage and focused 13-test scanner/package/install stage                                                                                |
| production Webpack build and route inventory                             | passed; `/studio/exchange` present                                                                                                                                         |
| controlled production restart                                            | two owned starts/stops passed against the same isolated validation family                                                                                                  |
| external baseline / canonical storage                                    | unchanged: SHA-256 `a05a9b06ef2abc747a22d843945299f916800bc5e4962f17b59e13024a06593f`, 905216 bytes, timestamp `2026-07-21T13:29:34.790Z`; worktree `prisma/dev.db` absent |
| cleanup                                                                  | task staging cleaned; ports 3100/3200 released; validation lock released                                                                                                   |

Production binary scanning remains fail-closed and requires a configured
trusted scanner for arbitrary non-test uploads.

PROJECT HARBORLIGHT PHASE 2 COMPLETE
