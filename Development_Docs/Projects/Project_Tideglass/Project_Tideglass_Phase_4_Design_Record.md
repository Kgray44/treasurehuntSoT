---
title: Project Tideglass Phase 4 Design Record
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-design
---

# Project Tideglass Phase 4 Design Record

## Baseline

| Field                      | Value                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| Phase branch               | `codex/project-tideglass-phase4-fix-the-bearings`                     |
| Phase base                 | `60b89841986e66fbc2c0828489d38002a1617506`                            |
| Phase 3 candidate ancestry | `aa161a377f87a4cbdbc6a8f308cee25493962bc5` is an ancestor of the base |
| Schema impact              | No new business schema planned                                        |
| Status                     | Implementation and qualification in progress; no acceptance claim     |

## Accepted architecture inventory

| Concern                                       | Current authority                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Exact edition resolution and authorization    | `src/tideglass/service.ts`                                                                                              |
| Canonical semantic snapshot and comparison    | `src/tideglass/semantic.ts`, `src/tideglass/comparison.ts`, `src/tideglass/core.ts`                                     |
| Change intelligence, compatibility, summaries | `src/tideglass/intelligence.ts`, `src/tideglass/projection.ts`                                                          |
| Creator annotations                           | `src/tideglass/annotations.ts`                                                                                          |
| Canonical cache                               | `src/tideglass/cache.ts`                                                                                                |
| HTTP safety and rate limits                   | `src/tideglass/http.ts`                                                                                                 |
| Privileged diagnostic projection              | `src/tideglass/diagnostics.ts`, governed Admiralty support route                                                        |
| Ordinary comparison passage                   | `src/tideglass/passage-service.ts`, `src/tideglass/passage.ts`, `src/components/tideglass/TideglassPassage.tsx`         |
| Studio comparison consumer                    | `src/components/tideglass/TideglassStudioComparison.tsx`, `src/app/api/studio/tales/[taleId]/versions/compare/route.ts` |
| Wakebook handoff                              | `src/components/wakebook/WakebookVoyageDetail.tsx`, `src/app/passport/history/[recordId]/compare/page.tsx`              |
| Existing Tideglass tests                      | `tests/tideglass/**`, `src/components/tideglass/*.test.tsx`                                                             |

The current policy identities remain `tideglass.semantic.v1`, `tideglass.policy.v1`,
`tideglass.change-codes.v1`, `tideglass.projection.v1`, `tideglass.summary.v1`, and
`tideglass.annotation.v1`. Phase 4 must not silently revise these identities.

## Drydock historical-reader seam

`src/tideglass/drydock-adapter.ts` is the only Phase 4 adapter boundary. It calls
the accepted `parseDrydockBlock` contract and never writes an edition, snapshot, or
Story Block. A successfully declared Drydock migration is compared in its canonical
form, suppressing representation-only changes. A newer unsupported or unsafe block
leaves the remainder of the Chronicle comparable and records a bounded unavailable
section. The established Tideglass v1 immutable-envelope reader remains available
only when no accepted Drydock migration certifies that legacy block; it is not an
independent upcaster.

## Cache integrity and diagnostics

The current accepted cache remains local-only and rebuildable. Phase 4 preserves
that truthful deployment state while adding an explicit corrupt-read signal:
digest-invalid canonical entries are evicted and the operation records
`CORRUPT_REBUILT` after recomputation. The optional provider read contract keeps
the existing provider seam compatible with a future accepted shared provider.

`POST /api/admin/support/tideglass` is an Admiralty consumer, not a Tideglass
admin system. It requires the existing support-use capability, CSRF validation,
recent privileged assurance, rate limit, active exact-target support grant with
`TIDEGLASS_DIAGNOSTICS`, and independently re-authorizes both editions as the
grant target. Its DTO excludes raw snapshots, annotations, private history,
credentials, tokens, storage keys, and media URLs.

## Current implementation evidence

The first completed Phase 4 increment is the Drydock migration-noise seam. Its
focused checks passed on this branch:

- `tests/tideglass/canonicalization.test.ts`: 15 tests passed.
- `tests/tideglass/comparison.test.ts`: 18 tests passed.
- `tests/tideglass/**`, focused Admiralty support contracts, and the new support
  diagnostic route: 18 files and 123 tests passed after task-local SQLite Prisma
  client generation.
- Cache corruption rebuild, diagnostic projection, and support-access schema
  checks: 16 focused tests passed after the Phase 4 additions.

Repository-wide `tsc --noEmit` currently reports pre-existing errors across
unrelated Prisma-dependent source and scripts. The command emitted no diagnostics
for `src/tideglass/drydock-adapter.ts`, `src/tideglass/semantic.ts`, or the changed
Tideglass canonicalization test.

This record is not a Phase 4 qualification, owner acceptance, or mainline receipt.

See `Project_Tideglass_Phase_4_Validation_Record.md` for the exact incremental
and browser-development evidence boundaries.
