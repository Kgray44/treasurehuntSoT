---
title: Project Wakebook Phase 2 Validation Record
audience: product-engineering
status: candidate-qualified
canonical_for: project-wakebook-phase-2-validation-record
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 validation record

Focused candidate qualification is complete after current-main reconciliation.
The frozen implementation candidate is
`823c9f726d778f59aa6df5dc5f2f383b7c22b5ba`; no authoritative acceptance,
protected merge, or Phase 3 work has been requested.

| Evidence                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and runtime          | Frozen implementation candidate `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba`. Local Chromium ran against fresh task-owned SQLite data under the Wakebook Phase 2 worktree; the canonical development database was not used.                                                                                                                                                                                                         |
| Prisma diagnosis            | Node `v24.19.0`, Prisma CLI/client `6.19.3`, and `prisma/schema.sqlite.prisma` were used. `prisma generate` and `prisma validate` passed with a task URL shaped `file:C:/wt/wb2-prisma/browser/<task-owned>.db`; the Windows schema engine existed and launched. The original `db push` failure was fresh SQLite-file creation, repaired by safely creating the task-owned file with that shipped engine before `migrate deploy`. |
| Focused contracts           | TypeScript passed. Eight focused Vitest files passed 30 tests across rich detail projection, unavailable-choice truthfulness, media state non-delivery, remembrance validation, component path, protected-media binding, and protected-media delivery.                                                                                                                                                                            |
| Browser journeys            | Registered Playwright project `wakebook-phase2`: 2 focused Chromium journeys passed on separate fresh task-owned SQLite files. The visible journey began at Chronicle Passport and used visible History and Voyage controls; the safety journey covered protected media, consent, and historical invariance.                                                                                                                      |
| Viewports and accessibility | Desktop 1440x1000 plus 430x932 and 640x900 responsive checks passed with no horizontal overflow. Keyboard focus and reduced-motion checks passed. Axe reported zero serious or critical violations.                                                                                                                                                                                                                               |
| Privacy and consent         | Owner-only detail and media delivery denied foreign access. Unscanned, withdrawn, archived, and revoked media remained non-deliverable. Participant consent denial, grant, and revocation each passed; regeneration removed revoked representation.                                                                                                                                                                               |
| Historical integrity        | Reflection and Memory write/edit/delete stayed owner scoped. Cross-owner consent was denied. Current Chronicle and crew changes did not rewrite historical title, Creator attribution, or crew snapshot. Artifact, assembly, achievement, and Tideglass handoff remained bounded.                                                                                                                                                 |
| Cleanup                     | Browser servers terminated after each run. Task-owned SQLite databases and failure artifacts are retained outside the repository for diagnostic provenance; no canonical data was changed.                                                                                                                                                                                                                                        |

The candidate source SHA, remote parity, and current branch relationship are
recorded by the candidate-freeze receipt. This is qualification evidence only,
not a release, owner acceptance, or merge claim.
