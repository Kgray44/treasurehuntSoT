---
title: Project Tideglass Phase 3 Validation Record
audience: product-engineering
status: current-main-wakebook-reconciliation
canonical_for: project-tideglass-phase-3-validation
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 validation record

Status: `CURRENT_MAIN_WAKEBOOK_RECONCILIATION`. The original product decision
remains recorded, while the accepted Wakebook Journey Detail handoff is being
qualified for targeted owner review.

The reconciled product source is
`c2fc8fcc414db4c2f3fab6108ba7c2e7becb16c6`, subsequently reconciled to accepted main
`541e914f481883200569f8cc7ec5ec9428d7cbb7`. Phase 2's accepted merge
`3219fd1b5598d1997b7f85d641f2f3cb1fe3f1b3` is an ancestor of that mainline.

| Evidence                                                  | Result                                                      | Boundary                                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run tideglass:phase3:validate`                       | PASS                                                        | Source-contract validation; no release authority dispatched.                                                                                     |
| Focused Tideglass, Passport, navigation, and Studio tests | PASS: 138 tests / 19 files                                  | Development verification of the passage, history ownership, semantic Studio cutover, return safety, performance, and component behavior.         |
| `npm run db:generate && npx tsc --noEmit`                 | PASS                                                        | Generated Prisma client refreshed for accepted Drydock schema; no Prisma schema or migration changed.                                            |
| `npm run tideglass:phase3:journeys`                       | PASS: real production build plus visible-entry journeys A-J | Task-owned synthetic SQLite, one isolated Chromium worker, mobile, keyboard, effective 200% zoom, reduced motion, and Axe serious/critical zero. |

The fixture uses only reserved synthetic accounts and Chronicle content. Comparison is read-only: the suite does not change a published edition, a live Voyage, a Wayfarer history record, an annotation, or canonical `prisma/dev.db`. It also verifies foreign history denial, server-derived audience, bounded return paths, and absence of raw snapshot product output.

The owner accepted this reconciled product on `2026-08-12`; the accepted reviewed
source is recorded in `Project_Tideglass_Phase_3_Owner_Decision_Record.md`.
The original product subsequently received its governed release evidence and
entered protected main as `bb7676a75581d8d415c3ff7712cc38bc8decb031`. The
record-only closeout path is not accepted current main, and this document does
not represent it as completed. No Deepwater finding closure, deployment, or
Phase 4 work has been started.

## Current accepted-Wakebook reconciliation

Current `origin/main` `cbf634d4d5db9cf47edebb89e005e8cc910068bd` accepts
Wakebook Phase 1, replacing the old Passport detail with Journey Detail. The
new Tideglass-owned adapter preserves the exact owned-history handoff without
copying a checksum, raw snapshot, annotation, or semantic record into the
Wakebook DTO. Focused proof is 34 tests across the direct Tideglass and
Wakebook files, plus passing `npm run tideglass:phase3:validate`, TypeScript,
and documentation validation. This is local, non-authoritative evidence only;
browser/visual addendum proof and targeted owner review remain pending.

## Authority preflight and focused repair

The first local Mainline Decision invocation for documentation candidate
`897e7619d1c110824a22b93c9e7c5ecef24989aa` ended before a suite receipt or
finalizer decision. Its exact preflight failure was
`ENOENT ...\\prisma\\dev.db`: this owned worktree intentionally has no baseline
database. It is recorded as an infrastructure preflight failure, not as a
passing decision or a product-test result.

The repair created a fresh task-owned baseline at
`%LOCALAPPDATA%\\ProjectTideglass\\phase3-mainline-authority\\baseline-897e7619.db`
from the canonical database as an immutable copy. The canonical source hash,
the clone hash before focused proof, the canonical hash after focused proof,
and the clone hash after focused proof were all
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`.
The non-authoritative, registered focused repair command
`node scripts/sounding-line/authority.mjs mainline --suite browser.access-sentinel --execute-only`
then passed all 3/3 access-sentinel cases with runtime conformance `PASSED`.
Only this infrastructure proof is carried forward; the next frozen candidate
must receive one replacement full Mainline Decision using that task-owned clone.

## Post-owner accepted-main reconciliation

The `4edc8de5..541e914f` advance contains Admiralty closeout documentation and
the accepted `4b346397` Helm browser-test stabilization only. No Tideglass route,
API, service, semantic, policy, schema, Studio consumer, or Chronicle/Passport
source changed. A direct product-path comparison against owner-reviewed
`c2fc8fcc` passed. The shared validation lane was occupied when the required
focused `browser.helm` rerun was requested, so it produced a governed
`validation-runtime.lock` refusal before any test was discovered or executed.
The lock was owned by another active process and was neither removed nor treated
as a product failure. After the governed lane released it, the focused command
passed all 3/3 `browser.helm` cases in its owned runtime (run
`validation-20260812T151554539Z-c62d2dc891ea`) with runtime conformance
`PASSED`. The canonical and task-owned baseline hashes remain
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`.
The reconciled replacement candidate is now frozen for its one full authority
attempt.

## Hosted authority failure and registry repair

Hosted run `31634707413` was explicitly bound to PR `#59`, base
`541e914f481883200569f8cc7ec5ec9428d7cbb7`, and candidate
`3c03e7a1f0aaab79ad725cacd00fb3e4036b4f41`. It failed in the **Plan** job
before any worker suite, plan artifact, finalizer, or acceptance envelope was
created. The exact error was `TIDEGLASS_PHASE3_TASK_ROOT is required` while the
governed registry asked Playwright to list tests. The browser spec read its
task-owned execution variables at module import time, which is invalid during
environment-free registry discovery. This is an authority-infrastructure
failure, not a semantic, product, privacy, or browser-journey failure.

The failure was reproduced locally with the same environment-free
`node scripts/sounding-line/test-registry.mjs` command. The repair defers the
three required Tideglass runtime variables until Playwright `beforeAll`; normal
execution still fails closed before any test if the task-owned fixture contract
is absent. The focused registry command then passed, `npx tsc --noEmit` passed,
and `npm run tideglass:phase3:journeys` passed from a fresh synthetic fixture
at `%LOCALAPPDATA%\\ProjectTideglass\\phase3-final-dbbe2c49` for source
`dbbe2c49aa884f6a5e078cfa3c5df580344ca221`. It rebuilt production and passed
the visible A--J journey (including Axe serious/critical zero, mobile,
keyboard, reduced motion, and effective 200% zoom). The task-owned fixture
again reported the canonical database as untouched.

This repair supersedes the failed hosted attempt. The next authority dispatch
must target a newly frozen, documentation-qualified SHA exactly once; the
failed run must not be retried.

## Final current-main reconciliation

Before the repaired freeze, fetched `origin/main` advanced from
`541e914f481883200569f8cc7ec5ec9428d7cbb7` to
`08ab5cedbcd16bf421b03b638af5c3513fe02019` through accepted Admiralty record
PR `#57`. The intervening files are generated Feature Catalog provenance,
Ledgerlight documentation inventory, and Helm browser-test stabilization only.
There is no Tideglass product, policy, API, route, navigation, schema, Studio,
Wayfarer, Wakebook, Shipwright, or Captain-consumer overlap. The branch merged
this accepted mainline change without a source conflict. The owner-reviewed
Tideglass product-path comparison still passes. The registry and Feature Catalog
provenance were regenerated, and the affected `browser.helm` focused suite
passed all 3/3 registered cases with runtime conformance `PASSED` (run
`validation-20260812T160328209Z-a9cdb9cbddc0`).

Accepted main then advanced through Helm Phase 2 and the Sounding Line
record-only closure to `fb0f13e35fcdd98434d22c357aee02f24d6d9036`. Helm changes
the accepted Player/Captain handoff and its own records; record-only changes the
governed authority/binding implementation and records. Neither interval changes
Tideglass routes, APIs, services, Chronicle/Passport presentation, Studio
semantic consumer, policy, schema, or navigation. The product-path comparison
against owner-reviewed `c2fc8fcc` remains clean; current registry discovery
passes with 2092 definitions, and Tideglass contract, TypeScript,
documentation, catalog, and formatting checks pass before the new freeze.
