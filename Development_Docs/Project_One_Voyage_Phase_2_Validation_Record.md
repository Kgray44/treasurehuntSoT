# Project One Voyage Phase 2 validation record

| Gate                                   | Result                              | Evidence                                                                                                                                                    |
| -------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote baseline                        | pass                                | `origin/main` was fetched and verified at `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2` before worktree creation                                               |
| MySQL 8.0.46 ordered rehearsal         | pass                                | 12 migrations, generic fixture migration/verify/rerun, zero shadow mismatch                                                                                 |
| Canonical compatibility runtime        | pass                                | one canonical event, one canonical audit, one observation, zero legacy writes                                                                               |
| Runtime database role                  | pass                                | isolated runtime account DDL denied                                                                                                                         |
| Backup/restore/restart                 | pass                                | SHA-256 recorded in rehearsal report; restored counts equal; one restart                                                                                    |
| SQLite ordered migration rehearsal     | pass                                | 13 ordered migrations applied by direct isolated SQLite execution; `PRAGMA foreign_key_check=[]`                                                            |
| Formatting                             | pass                                | `prettier --check .` exit 0                                                                                                                                 |
| Lint                                   | pass with inherited warnings        | 23 warnings, 0 errors                                                                                                                                       |
| TypeScript                             | pass                                | `tsc --noEmit` exit 0                                                                                                                                       |
| Language and architecture              | pass                                | both validators exit 0; Windows architecture entrypoint was repaired from a no-op                                                                           |
| Focused observation test               | pass                                | 2 files, 2 tests                                                                                                                                            |
| Complete unit suite                    | pass                                | 93 files, 863 tests                                                                                                                                         |
| Optimized Webpack build                | pass                                | Next 16.2.10 production build exit 0                                                                                                                        |
| Focused Chromium compatibility journey | pass after Harborlight route repair | Chromium compatibility, revocation, refresh, and Quartermaster evidence passed after `/api/community/listings/public/[slug]` replaced the conflicting route |
| Animation assets                       | external NO-GO                      | four missing production Rive authoring/export pairs; unrelated to One Voyage implementation                                                                 |

The live MySQL proof exposed and corrected previously unproven production SQL
parity: parenthesized LONGTEXT JSON defaults, a valid-width LegacyEntityReference
unique index, and the missing Wayfarer actor-account columns/foreign keys.

## 2026-07-22 acceptance closure

The historical blocked Chromium attempt remains valid evidence: it was blocked by Harborlight's inherited dynamic route conflict. Harborlight repaired it on `fix/harborlight-community-listing-routes`; corrected `origin/main` is `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`, moving the public route to `/api/community/listings/public/[slug]`. This branch merged that repair at `867656befd2b2e83b531539a80b2e63b95b49352`.

`node node_modules/@playwright/test/cli.js test tests/e2e/project-one-voyage-phase2.spec.ts --project=chromium --no-deps` ran on port 3100 (passing-run PID 45788) against nonce-bound `phase2-browser-isolated-r4.db` (final SHA-256 `3380cd542033f3a2c7756d00b8d5a674111d1cde5660c0386d7756cb5f77581c`). Chromium 1.56.1 passed 3/3 journeys in 83.1 seconds: startup/root and Community route 200; historical Player exchange/canonical state and refresh; revoked credential denial without a session; and Quartermaster to Captain handoff with one command. That command produced exactly one canonical event, one audit, one Quartermaster observation; all journeys recorded four safe observations and zero legacy `ProgressEvent` or `AdminAuditLog` writes. The canonical seed database family was unchanged. Focused browser gate: pass.
