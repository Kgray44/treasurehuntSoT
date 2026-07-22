# Project One Voyage Phase 2 integration manifest

Repository: `Kgray44/treasurehuntSoT`

## Acceptance closure (2026-07-22)

Original implementation SHA: `4aa64f3e4`; corrected main SHA: `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`; merge/pre-closure SHA: `867656befd2b2e83b531539a80b2e63b95b49352`. Latest `origin/main` remains corrected main; pre-closure state was 3 ahead and 0 behind. Closure changes: the revocation guard, its focused unit test, `tests/e2e/project-one-voyage-phase2.spec.ts`, and these records. Chromium browser evidence passed 3/3 in 83.1 seconds with an unchanged canonical seed family. Migration order stays SQLite `20260722110000`, MySQL `0011` (`0012` unused). Convergence order remains One Voyage first, Wayfarer second, Sealed Hold third, Harborlight last; likely overlaps are Wayfarer session policy, Sealed Hold checks, and Harborlight route/release lineage. Do not merge this branch automatically.
Branch: `codex/project-one-voyage-phase2-close-the-old-passage`
Starting main: `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`
Ending branch SHA: recorded after final validation commit
Migration range: SQLite `20260722110000`; MySQL `0011`; `0012` unused.

Shared files changed: both Prisma schemas, MySQL migration chain, package
scripts, compatibility adapters, identity session boundary, architecture
validator, retirement manifest, and One Voyage documentation. Likely
convergence concerns are Wayfarer account/session policy and actor FKs;
Sealed Hold relationship checks; Harborlight immutable release lineage; and
no Lanternwake runtime change. Merge One Voyage before any dependent Phase 2
work, then rerun Prisma connector validation, MySQL rehearsal, complete tests,
and production build. Do not merge this branch automatically.
