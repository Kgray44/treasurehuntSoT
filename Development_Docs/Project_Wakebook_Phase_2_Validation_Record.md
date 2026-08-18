---
title: Project Wakebook Phase 2 Validation Record
audience: product-engineering
status: candidate-qualification-in-progress
canonical_for: project-wakebook-phase-2-validation-record
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 validation record

Phase 2 implementation is reconciled with current protected main. The current
implementation source is `faeec00ff755d4ab63c9427bdaf3a394fd93145a`, whose
first parent contains the preserved Phase 2 work and whose second parent is
protected main `fc39942a1d8fe57fc13f35cae01445e704b94c45`. A documentation
candidate remains to be frozen; no release, protected merge, owner acceptance,
or Phase 3 work is claimed.

| Evidence                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and runtime          | Reconciled implementation source `faeec00ff755d4ab63c9427bdaf3a394fd93145a`; local Chromium used synthetic task-owned SQLite fixtures only. The canonical development database was never used. |
| Prisma diagnosis            | Node `v24.19.0`, Prisma CLI/client `6.19.3`, schema `prisma/schema.sqlite.prisma`, and Windows x64 schema engine `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`. Engine launch and `prisma generate` passed; `prisma validate` passed with a sanitized `file:Y:/CodexTaskOwned/WakebookPhase2/<task-owned>.db` URL. Fresh `migrate deploy` later failed identically for short C: and Y: paths with blank `Schema engine error`; no canonical database was touched. |
| Focused contracts           | PASS: eight focused Vitest files, 30 tests, plus TypeScript. Coverage includes rich detail projection, unavailable-choice truthfulness, media state non-delivery, remembrance validation, component path, protected-media binding, and protected-media delivery. |
| Visible browser journey     | PASS: registered Playwright project `wakebook-phase2`, Chromium desktop 1440x1000, fresh Y: fixture `wakebook-phase2-v14-final-visible.db`, all 59 migrations, 1/1 journey. It begins from visible Chronicle Passport, History, and Voyage controls. |
| Safety browser journey      | Not locally qualified. The initial fresh Y: fixture applied all 59 migrations, but the runner failed only while writing its failure artifact to the full C: worktree (`ENOSPC`) during cleanup. A Y:-redirected retry timed out while the local runtime had only ~5 MB C: free; later fresh migration attempts reproduced the schema-engine initialization failure above. |
| Hosted focused route        | The exact registered suite is `browser.wakebook` and its Playwright project is `wakebook-phase2`; it declares only application-port, SQLite-clone, browser-chromium, and trace-root. Hosted focused-repair dispatches `32138675826` and `32138692288` stopped before a worker because v1.4 requires protected-main context. They produced neither suite evidence nor a release decision. |
| Privacy and consent         | Direct contracts passed for foreign-owner denial, unavailable media non-delivery, owner-scoped Reflection/Memory validation, protected-media delivery, and consent/revocation behavior. The browser safety journey still requires source-bound hosted proof. |
| Historical integrity        | Direct contracts passed for historical snapshot, artifact/achievement, Tideglass, and owner-bound projection seams. The browser safety journey still requires source-bound hosted proof. |
| Cleanup                     | Browser servers terminated. Task-owned databases and diagnostic artifacts are retained under `Y:\CodexTaskOwned\WakebookPhase2`; no canonical data changed. |

Pre-cutover candidate `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba` and its
focused evidence remain bounded legacy evidence. Current policy/registry proof
now passes with 2,386 cases across 57 families, 63 suites, and policy digest
`ffacb4c2ee61eeef2db00b49b0928ee147fca47d76749b4d1f4151dc7f3e51a8`.

The remaining qualification is source-bound hosted execution of the required
browser safety scope through the v1.4 protected-main authority/train path. It
must be attempted only after the documentation candidate is frozen, and a
`RELEASE_GO` is required before protected merge. This record does not claim
local safety-browser proof or owner acceptance.
