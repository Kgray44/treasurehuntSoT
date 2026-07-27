# Project One Voyage validation record

## Phase 2 superseding proof

An isolated MySQL 8.0.46 ordered migration/runtime/backup/restore/restart
rehearsal passed on the dedicated Phase 2 branch. The detailed current record
is `Project_One_Voyage_Phase_2_Validation_Record.md`; production deployment and
the one-release legacy observation window remain separate gates.

Date: 2026-07-21
Worktree: `integration/lanternwake-phase5-universal-language` from `a0a2111c`
Configured stage: `F_COMPATIBILITY_ONLY` (canonical read and write paths are the application default; legacy surfaces are bounded adapters)

## Status ledger

| State                                 | Status             | Meaning                                                                                                                                                        |
| ------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project One Voyage implementation     | complete           | Stage F defaults, canonical command/projection paths, bounded adapters, migration tooling, retirement enforcement, and records are implemented on this branch. |
| Project One Voyage focused validation | pass               | Isolated migration/parity proof, type/static gates, unit suite, focused Chromium journey, and two production-start recovery checks passed.                     |
| Live MySQL environment                | unavailable        | No repository-supported isolated credentials or test schema were configured; schema validation is not represented as live migration proof.                     |
| Repository-wide release validation    | blocked externally | The full harness stops at the Lanternwake Rive asset-authoring gate before browser/restart phases.                                                             |
| Integration readiness                 | blocked            | Requires the independent Rive assets and a live isolated MySQL migration/runtime proof. This is not a merge approval.                                          |

## Isolated migration proof

The development database was copied into a unique local validation SQLite file. Its SHA-256 before and after the proof was `a05a9b06ef2abc747a22d843945299f916800bc5e4962f17b59e13024a06593f`; the isolation harness also confirmed the full database file family was unchanged.

1. `prisma migrate deploy --schema prisma/schema.sqlite.prisma` applied `20260721113000_project_one_voyage` successfully to the isolated copy.
2. Migration dry run for `development-forever-treasure` found one source Campaign with five chapters, five artifacts, four side quests, five locations, two routes, and one Player access record.
3. Execute mode created one Chronicle, one published version, one Chronicle Session, one Player profile, one membership, and 60 deterministic source-to-canonical references. It reported no failure, checksum mismatch, or unmapped field.
4. Verify mode passed with no mismatch. A second execute reported the expected already-mapped warning and created no duplicate canonical record.

The isolation report is local validation evidence only; it contains no source story payload, access code, token, or raw audit content.

## Static and focused test gates

- `scripts/validate-project-one-voyage.ts` passed: active source/documentation scan has no retired product term, and Player/GM adapter routes have no direct legacy-table writers.
- `src/compatibility/project-one-voyage-stage.test.ts` passed.
- Source-path scan found no active retired-name path. Historical Prisma migration identifiers and compatibility SQL are intentionally retained because changing applied migration history would prevent installed-database upgrades.

## Cutover evidence

- Shadow comparison of the migrated fixture passed with zero semantic mismatches across current chapter/block, completed chapters, inventory, side-quest state, map/route reveals, Player membership, lifecycle, event sequence, and presentation acknowledgement.
- Canonical reads are the default for migrated legacy URLs. The legacy Player and GM response shapes are projections of `TaleSession` state and canonical events; they do not reconstruct business state from legacy tables.
- Canonical writes are the default. The legacy progression module is explicitly disabled for production route use; Quartermaster and GM compatibility requests resolve provenance mappings, enforce canonical policy, and write only `TaleSession`, `TaleSessionEvent`, `RevealState`, and `PlatformAuditEvent`.
- `tsc --noEmit` passes after the retained command boundary was narrowed to the canonical dispatcher. The targeted Player compatibility suite passes (8 tests); the complete unit suite passes (86 files, 843 tests).

## Validation runs on 2026-07-21

| Gate                             | Result                          | Evidence                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| formatting                       | pass                            | `prettier --check .` completed with no style errors                                                                                                                                                                                                                                                                                       |
| lint                             | pass with 19 existing warnings  | no ESLint errors                                                                                                                                                                                                                                                                                                                          |
| type check                       | pass                            | `tsc --noEmit` exit 0                                                                                                                                                                                                                                                                                                                     |
| language and retirement checks   | pass                            | product-language validator and `validate-project-one-voyage.ts` exit 0                                                                                                                                                                                                                                                                    |
| focused compatibility            | pass                            | Player event/viewed adapters: 8 tests; GM status and registry regression set: 9 tests                                                                                                                                                                                                                                                     |
| complete unit suite              | pass                            | 86 files, 843 tests, 0 failures                                                                                                                                                                                                                                                                                                           |
| post-browser unit rerun          | unrelated baseline failure      | The invitation change type-checked and its focused Chromium journey passed. A later complete-unit rerun reported `AnimationShowcase` trailer timing/count (33 of 34 rerun tests passed); the journal teardown test passed in isolation. This unrelated animation-harness failure does not exercise Project One Voyage routes or services. |
| migration / shadow proof         | pass on isolated SQLite fixture | one migrated Chronicle/version/session; 60 mappings; verify and rerun idempotency; zero shadow mismatches                                                                                                                                                                                                                                 |
| MySQL schema proof               | pass (schema only)              | MySQL Prisma schema validates and generates with an inert isolated URL; no database connection was attempted                                                                                                                                                                                                                              |
| optimized build                  | pass                            | `next build` exit 0                                                                                                                                                                                                                                                                                                                       |
| focused Chromium browser journey | pass                            | `chronicle-platform.spec.ts --project=chromium --no-deps`: 2 tests passed in 3.6 minutes on an owned SQLite copy; covers role authorization, reduced motion, invitation acceptance, immutable version pinning, Player runtime, archive, and revocation                                                                                    |
| restart recovery                 | pass                            | optimized production build started twice on owned port 3200, each returned HTTP 200 and released the port afterward                                                                                                                                                                                                                       |
| visible compatibility check      | pass (bounded)                  | `/quartermaster` redirected to `/captain/sign-in` on an owned local validation server; port was released afterward                                                                                                                                                                                                                        |
| full repository harness          | blocked external                | `scripts/test-all.ps1` passed formatting, lint, type, language, and all 843 unit tests, then stopped at the pre-existing Lanternwake production Rive asset gate before browser/restart/build steps                                                                                                                                        |

## Release boundary and remaining external proof

This branch did not touch a production database, asset store, or shared canonical checkout. A local MySQL service was present, but no isolated least-privilege schema or credentials were supplied; no credential guessing or shared-database probe was performed. Consequently, live MySQL migration/runtime proof is recorded as pending external environment evidence rather than passed. The isolated SQLite migration, shadow comparison, repository validation runtime, and restart/browser harness are safe local evidence only.

Legacy tables are retained read-only for migration provenance and compatibility resolution. They may be removed only after a release with live MySQL proof, retained backup/restore evidence, zero unexplained parity mismatches, and one full compatibility release period with zero production legacy-writer reachability.
