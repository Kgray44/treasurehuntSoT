---
title: Project Wakebook Phase 2 Validation Record
audience: product-engineering
status: candidate-qualification-in-progress
canonical_for: project-wakebook-phase-2-validation-record
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 validation record

Phase 2 implementation is reconciled with current protected main. The current
reconciliation source is `e7acab5dc8e415b30e571ebf696d85ef63fdb587`, whose
first parent contains the preserved Phase 2 work and whose second parent is
protected main `b6b613674a60fcf134426a5e964d11c454ee0698`. A final candidate
remains to be frozen; no release, protected merge, owner acceptance, or Phase 3
work is claimed.

| Evidence                | Result                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and runtime      | Reconciliation source `e7acab5dc8e415b30e571ebf696d85ef63fdb587`; all local work used synthetic task-owned SQLite fixtures only. The canonical development database was never used.                                                                                                                                                                                                                                   |
| Prisma diagnosis        | Node `v24.19.0`, Prisma CLI/client `6.19.3`, schema `prisma/schema.sqlite.prisma`, and Windows x64 schema engine `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`. Engine launch and `prisma generate` passed; `prisma validate` passed with sanitized task-owned URLs. Fresh `migrate deploy` failed identically for short C: and Y: paths with blank `Schema engine error`; no canonical database was touched.            |
| Focused contracts       | PASS: eight focused Vitest files, 27 tests. Coverage includes rich detail projection, unavailable-choice truthfulness, media state non-delivery, remembrance validation, component path, protected-media binding, and protected-media delivery. Scoped Wakebook TypeScript, targeted lint, and targeted formatting passed; broad repository TypeScript is separately blocked by missing Bridgewatch dependencies.     |
| Visible browser journey | PASS: registered Playwright project `wakebook-phase2`, Chromium desktop 1440x1000, fresh Y: fixture `wakebook-phase2-v14-final-visible.db`, all 59 migrations, 1/1 journey. It begins from visible Chronicle Passport, History, and Voyage controls.                                                                                                                                                                  |
| Safety browser journey  | Not locally qualified. The initial fresh Y: fixture applied all 59 migrations, but the runner failed only while writing its failure artifact to the full C: worktree (`ENOSPC`) during cleanup. A Y:-redirected retry timed out while the local runtime had only ~5 MB C: free; later fresh migration attempts reproduced the schema-engine initialization failure above.                                             |
| Hosted focused route    | The exact registered suite is `browser.wakebook` and its Playwright project is `wakebook-phase2`; it declares only application-port, SQLite-clone, browser-chromium, and trace-root. After PR #205 resolved admission, focused-repair dispatch `32153529083` against `e7acab5dc8e415b30e571ebf696d85ef63fdb587` ended as GitHub `startup_failure` with no jobs, logs, workers, browser evidence, or release decision. |
| Privacy and consent     | Direct contracts passed for foreign-owner denial, unavailable media non-delivery, owner-scoped Reflection/Memory validation, protected-media delivery, and consent/revocation behavior. The browser safety journey still requires source-bound hosted proof.                                                                                                                                                          |
| Historical integrity    | Direct contracts passed for historical snapshot, artifact/achievement, Tideglass, and owner-bound projection seams. The browser safety journey still requires source-bound hosted proof.                                                                                                                                                                                                                              |
| Cleanup                 | Browser servers terminated. Task-owned databases and diagnostic artifacts are retained under `Y:\CodexTaskOwned\WakebookPhase2`; no canonical data changed.                                                                                                                                                                                                                                                           |

Pre-cutover candidate `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba` and its
focused evidence remain bounded legacy evidence. Current policy/registry proof
now passes with 2,412 cases across 57 families, 63 suites, and policy digest
`62c6fda0beaf401ae0a190a0e2d65aff544c5235323ef496c3f4a6d46ca4986e`.

The remaining qualification is source-bound hosted execution of the required
browser safety scope through one v1.4 candidate Mainline Decision after this
documentation candidate is frozen. A `RELEASE_GO` is required before protected
merge. This record does not claim local safety-browser proof or owner acceptance.

## v1.4 admission result

PR #205 landed the generic `PRODUCT_WITH_VERIFICATION_REGISTRATION` candidate
class on protected main. Read-only classification of preserved PR #197 against
that trusted policy returns that class, owner `project-wakebook`, and zero
errors. The earlier run `32139704608` remains historical evidence of the
pre-PR-205 rejection only; it is superseded as an admission blocker. No
`RELEASE_GO` exists yet.
