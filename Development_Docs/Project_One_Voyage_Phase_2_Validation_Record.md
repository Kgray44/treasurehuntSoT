# Project One Voyage Phase 2 validation record

| Gate                                   | Result                                      | Evidence                                                                                                             |
| -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Remote baseline                        | pass                                        | `origin/main` was fetched and verified at `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2` before worktree creation        |
| MySQL 8.0.46 ordered rehearsal         | pass                                        | 12 migrations, generic fixture migration/verify/rerun, zero shadow mismatch                                          |
| Canonical compatibility runtime        | pass                                        | one canonical event, one canonical audit, one observation, zero legacy writes                                        |
| Runtime database role                  | pass                                        | isolated runtime account DDL denied                                                                                  |
| Backup/restore/restart                 | pass                                        | SHA-256 recorded in rehearsal report; restored counts equal; one restart                                             |
| SQLite ordered migration rehearsal     | pass                                        | 13 ordered migrations applied by direct isolated SQLite execution; `PRAGMA foreign_key_check=[]`                     |
| Formatting                             | pass                                        | `prettier --check .` exit 0                                                                                          |
| Lint                                   | pass with inherited warnings                | 23 warnings, 0 errors                                                                                                |
| TypeScript                             | pass                                        | `tsc --noEmit` exit 0                                                                                                |
| Language and architecture              | pass                                        | both validators exit 0; Windows architecture entrypoint was repaired from a no-op                                    |
| Focused observation test               | pass                                        | 2 files, 2 tests                                                                                                     |
| Complete unit suite                    | pass                                        | 93 files, 863 tests                                                                                                  |
| Optimized Webpack build                | pass                                        | Next 16.2.10 production build exit 0                                                                                 |
| Focused Chromium compatibility journey | blocked inherited dev-server route conflict | Next development server rejects two inherited dynamic segment names (`id` and `slug`); optimized build remains green |
| Animation assets                       | external NO-GO                              | four missing production Rive authoring/export pairs; unrelated to One Voyage implementation                          |

The live MySQL proof exposed and corrected previously unproven production SQL
parity: parenthesized LONGTEXT JSON defaults, a valid-width LegacyEntityReference
unique index, and the missing Wayfarer actor-account columns/foreign keys.
