# Phase 1 Cross-Project Validation Record

Status: pushed blocked-acceptance candidate. No final acceptance claim is made by this record.

| Gate | Command/environment | Result |
| --- | --- | --- |
| Remote preflight | isolated bare mirror; live `git ls-remote` | passed; `origin/main=0ecd2f9cca6116e2f7f9ab4408ade749fb061e72` and all three frozen candidate commits verified |
| SQLite migration rehearsal | `scripts/test-all.ps1 -SkipBrowserInstall`; disposable local validation `prisma/validation.db` | passed; all 9 ordered migrations applied to an empty isolated SQLite database |
| Prisma generate | same isolated local validation runtime | passed |
| Formatting | same | passed after convergence formatting commit |
| Lint | same | passed with 23 warnings and 0 errors |
| TypeScript | same | passed |
| Voyagewright language | same | passed |
| Unit tests | Vitest 4.1.10 in isolated local runtime | 89 files, 852 tests passed |
| One Voyage architecture validator | isolated local validation runtime | passed |
| Private repository/build scans | isolated local validation runtime | both passed |
| Lanternwake production assets | `tsx scripts/validate-animation-assets.ts` | NO-GO: four genuine Rive authoring/export pairs are absent |

The full harness correctly stopped at the asset NO-GO, so production build, browser journeys, restart proof, and the harness's later database checks are **not run**. No isolated MySQL endpoint/schema was configured for this task, so live MySQL migration/runtime proof is **not run**. These are skips/blockers, not passes.

The missing external artifacts are: invitation seal, journal clasp, voyage compass, and finale mechanism Rive source/export pairs. The implementation candidate remains durable and pushable; release acceptance remains blocked until those artifacts and the deferred browser/MySQL/restart gates are supplied and passed.
