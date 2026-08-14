---
title: Project Wakebook Phase 2 Validation Record
audience: product-engineering
status: ready-for-v14-mainline-acceptance
canonical_for: project-wakebook-phase-2-validation-record
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 validation record

Focused candidate qualification is complete after Sounding Line v1.4 current-main
reconciliation. The rebounded implementation candidate is
`beb86ca66c5e4d648d0df2565c2d197831f2174e`; no authoritative acceptance,
protected merge, or Phase 3 work has been requested.

| Evidence                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and runtime          | Rebounded implementation candidate `beb86ca66c5e4d648d0df2565c2d197831f2174e`, reconciled with protected main `268932d630ee0ea1721d0072da4041f7209b7464`. Local Chromium ran against fresh task-owned SQLite data under the Wakebook Phase 2 worktree; the canonical development database was not used.                                                                                                                           |
| Prisma diagnosis            | Node `v24.19.0`, Prisma CLI/client `6.19.3`, and `prisma/schema.sqlite.prisma` were used. `prisma generate` and `prisma validate` passed with a task URL shaped `file:C:/wt/wb2-prisma/browser/<task-owned>.db`; the Windows schema engine existed and launched. The original `db push` failure was fresh SQLite-file creation, repaired by safely creating the task-owned file with that shipped engine before `migrate deploy`. |
| Focused contracts           | Rebound under v1.4: TypeScript passed. Eight focused Vitest files passed 30 tests across rich detail projection, unavailable-choice truthfulness, media state non-delivery, remembrance validation, component path, protected-media binding, and protected-media delivery.                                                                                                                                                        |
| Browser journeys            | Rebound under v1.4 in registered Playwright project `wakebook-phase2`: 2 focused Chromium journeys passed on separate fresh task-owned SQLite files. The visible journey began at Chronicle Passport and used visible History and Voyage controls; the safety journey covered protected media, consent, and historical invariance.                                                                                                |
| Viewports and accessibility | Desktop 1440x1000 plus 430x932 and 640x900 responsive checks passed with no horizontal overflow. Keyboard focus and reduced-motion checks passed. Axe reported zero serious or critical violations.                                                                                                                                                                                                                               |
| Privacy and consent         | Owner-only detail and media delivery denied foreign access. Unscanned, withdrawn, archived, and revoked media remained non-deliverable. Participant consent denial, grant, and revocation each passed; regeneration removed revoked representation.                                                                                                                                                                               |
| Historical integrity        | Reflection and Memory write/edit/delete stayed owner scoped. Cross-owner consent was denied. Current Chronicle and crew changes did not rewrite historical title, Creator attribution, or crew snapshot. Artifact, assembly, achievement, and Tideglass handoff remained bounded.                                                                                                                                                 |
| Cleanup                     | Browser servers terminated after each run. Task-owned SQLite databases and failure artifacts are retained outside the repository for diagnostic provenance; no canonical data was changed.                                                                                                                                                                                                                                        |

Pre-cutover candidate `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba` and its
focused evidence remain preserved as bounded legacy evidence. They were not
promoted to v1.4 authority; affected source, runtime, policy, registry, and
browser identities were rebound above.

The remaining external hold is the independent Sounding Line v1.4
post-cutover hosted browser-fixture closure. Until it is confirmed green, this
phase is `READY_FOR_V14_MAINLINE_ACCEPTANCE` only: no Mainline Decision,
protected merge, release, owner acceptance, or Phase 3 work is authorized.
