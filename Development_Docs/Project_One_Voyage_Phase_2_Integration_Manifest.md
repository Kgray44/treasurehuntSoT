# Project One Voyage Phase 2 integration manifest

Repository: `Kgray44/treasurehuntSoT`
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
