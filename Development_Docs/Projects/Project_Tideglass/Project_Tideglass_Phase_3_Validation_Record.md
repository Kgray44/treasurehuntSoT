---
title: Project Tideglass Phase 3 Validation Record
audience: product-engineering
status: owner-accepted-mainline-pending
canonical_for: project-tideglass-phase-3-validation
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 validation record

Status: `OWNER_ACCEPTED_MAINLINE_PENDING`.

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
This is still local qualification evidence until the next authority, one frozen
exact-SHA Sounding Line Mainline Decision, is `RELEASE_GO`. No protected merge,
Deepwater finding closure, deployment, or Phase 4 work has been started.

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
