---
title: Project Wakebook Phase 2 Validation Record
audience: product-engineering
status: qualification-blocked-external-catalog
canonical_for: project-wakebook-phase-2-validation-record
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 validation record

Phase 2 implementation is reconciled with protected main
`70afa7ce9f6a2c77394b96020340c069222d60f9`. Frozen candidate
`5a7f3e5752c49bbb9816f6de42e4f28c31743b67` includes the browser-qualified
test-fixture source `ecc3f9841980e9cb389a95d8ab83ab6fa8d5b940`. No release,
protected merge, owner acceptance, or Phase 3 work is claimed.

| Evidence                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and runtime      | Frozen candidate `5a7f3e5752c49bbb9816f6de42e4f28c31743b67`; reconciliation source `5461eb67a4bf10f6cbe7d7bac242884383ebfd17`; local browser source `ecc3f9841980e9cb389a95d8ab83ab6fa8d5b940`; all local work used synthetic task-owned SQLite fixtures only. The canonical development database was never used.                                                                                                                                                                                                                                                                                         |
| Prisma diagnosis        | Node `v24.19.0`, Prisma CLI/client `6.19.3`, schema `prisma/schema.sqlite.prisma`, and Windows x64 schema engine `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`. Engine launch and `prisma generate` passed; `prisma validate` passed with sanitized task-owned URLs. Fresh `migrate deploy` still fails identically for short C: and Y: paths with blank `Schema engine error`, while schema-engine CLI SQLite create/connect and Prisma `db execute` both succeed. The task-owned browser fixture used `db execute` to apply all 59 checked-in migration SQL files; no canonical database was touched.      |
| Focused contracts       | PASS: eight focused Vitest files, 27 tests. Coverage includes rich detail projection, unavailable-choice truthfulness, media state non-delivery, remembrance validation, component path, protected-media binding, and protected-media delivery. Scoped Wakebook TypeScript, targeted lint, and targeted formatting passed; broad repository TypeScript is separately blocked by missing Bridgewatch dependencies.                                                                                                                                                                                         |
| Visible browser journey | PASS: registered Playwright project `wakebook-phase2`, Chromium desktop 1440x1000, fresh Y: fixture `wakebook-phase2-v14-final-visible.db`, all 59 migrations, 1/1 journey. It begins from visible Chronicle Passport, History, and Voyage controls.                                                                                                                                                                                                                                                                                                                                                      |
| Safety browser journey  | PASS: source `ecc3f9841980e9cb389a95d8ab83ab6fa8d5b940`, project `wakebook-phase2`, Chromium, 2/2 tests, fresh task-owned C: database `wakebook-phase2-raw-migrations.sqlite`, 59 raw migration files applied. The first test passed visible navigation, desktop/mobile/zoom/keyboard/reduced-motion and axe serious/critical checks; the second passed owner/foreign denial, private media states, consent denial/grant/revocation, Keepsake redaction, and underlying Voyage invariance.                                                                                                                |
| Hosted focused route    | The exact registered suite is `browser.wakebook` and its Playwright project is `wakebook-phase2`; it declares only application-port, SQLite-clone, browser-chromium, and trace-root. After PR #205 resolved admission, focused-repair dispatch `32153529083` against `e7acab5dc8e415b30e571ebf696d85ef63fdb587` ended as GitHub `startup_failure` with no jobs, logs, workers, browser evidence, or release decision. Reconciled candidate `9ca51c05216aac8f2f989b5bb6f8d42fb93fe63e` reproduced that result in exact runs `32159196719` and `32159273263`: each completed in two seconds with zero jobs. |
| Privacy and consent     | PASS: direct contracts and the safety browser journey cover foreign-owner denial, unavailable media non-delivery, owner-scoped Reflection/Memory validation, protected-media delivery, consent denial/grant/revocation, and Keepsake redaction.                                                                                                                                                                                                                                                                                                                                                           |
| Historical integrity    | PASS: direct contracts and the safety browser journey cover historical snapshot, artifact/achievement, Tideglass, owner-bound projection seams, and underlying Voyage invariance after consent revocation.                                                                                                                                                                                                                                                                                                                                                                                                |
| Cleanup                 | Browser server terminated. Task-owned databases, reports, traces, and diagnostic artifacts are retained under `C:\CodexTaskOwned\WakebookPhase2`; no canonical data changed.                                                                                                                                                                                                                                                                                                                                                                                                                              |

Pre-cutover candidate `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba` and its
focused evidence remain bounded legacy evidence. Current policy/registry proof
now passes with 2,419 cases across 57 families, 63 suites, and policy digest
`db91bb4bb1415e46d3687bd353541676744a15d3b43da02430563565bc27c88a`.

The required browser safety scope is locally qualified. A source-bound v1.4
candidate Mainline Decision was attempted for the frozen candidate, but no
`RELEASE_GO` was issued; protected merge remains prohibited. This record does
not claim owner acceptance.

## v1.4 admission result

PR #205 landed the generic `PRODUCT_WITH_VERIFICATION_REGISTRATION` candidate
class on protected main. Read-only classification of preserved PR #197 against
that trusted policy returns that class, owner `project-wakebook`, and zero
errors. The earlier run `32139704608` remains historical evidence of the
pre-PR-205 rejection only; it is superseded as an admission blocker. Authority
run `32154971683` was bound to the prior candidate/base and broadened under
`UNKNOWN_IMPACT` because three support paths were unmapped; it is not a
Wakebook browser receipt or a release decision. No `RELEASE_GO` exists yet.

## Browser qualification and authority hold

The current direct product/contract, policy, registry, catalog, privacy,
documentation, and browser evidence is green. The earlier hosted startup
failures and the local `migrate deploy` engine defect remain recorded, but the
supported raw migration execution path supplied a fresh isolated fixture and
the full unmodified Wakebook browser scenario passed.

Authoritative run `32160955382` was dispatched once for prior candidate
`3c4926adf4ade4fb2628d98601a3426171394ac6`, base
`a6c1f441d3628bd828bd7a1c3cd77d419a0701c6`, and PR #197. Its sealed plan
fell back under `PROJECT_DISCOVERY_CONSERVATIVE`, selecting cross-project
browser suites but not `browser.wakebook`. Wave 0 failed on external suites,
including Lanternwake WebKit mobile zoom overflow and Tideglass's missing
`TIDEGLASS_PHASE3_TASK_ROOT`; the finalizer rejected Wave 0 prerequisites and
issued no finalization artifact or `RELEASE_GO`. This is not Wakebook product
failure or browser evidence. The accepted Deepwater Phase 5 reconciliation from
`3c4926adf4ade4fb2628d98601a3426171394ac6` to the current candidate did not
touch a Wakebook source, route, Prisma, Playwright, or test-registration seam;
its focused evidence remains applicable. The phase is locally complete and
`READY_FOR_V14_MAINLINE_ACCEPTANCE`, pending resolution of the shared v1.4
browser-matrix hold and a later, fresh authoritative decision.

## Current v1.4.2 reconciliation

This section supersedes the earlier shared-browser-matrix hold. Protected main
is `bef72d4ca3806330e10a36cdd39316921e26e733`; pre-record source
`00034e64f4878971e78b718e9fa7e128abf2da76` contains that mainline plus the
narrow mapping for the required Phase 2 capability-impact JSON. The current
non-authoritative plan is exact (digest
`4835792a85e04856efe24e3662b21e10469e0e6074b7e14bcb9ac9900273e579`) and
selects `browser.wakebook` / `wakebook-phase2` without global broadening.

Current evidence passes: 36 focused tests in nine Vitest files; scoped format,
ESLint, TypeScript, user-language, and One Voyage checks; documentation;
private-content scan; policy validation with zero errors; and registry
generation of 2,459 cases across 57 families. A fresh task-owned C: SQLite
fixture received all 59 migrations with Prisma `db execute`, then the dedicated
Chromium browser project passed 2/2. It covers visible navigation,
desktop/mobile/200% zoom/keyboard/reduced-motion/axe, historical detail,
owner/foreign denial, Reflection/Memory behavior, protected media, consent
denial/grant/revocation, Keepsake redaction, and Voyage invariance. Its server
was stopped and port 3111 released.

`features:sync` passes, but `features:validate` fails on inherited FT-036: its
Drydock branch `codex/project-drydock-phase3-run-sea-trials` no longer resolves.
Wakebook cannot alter that foreign capability claim. This external catalog
defect prevents candidate freeze and a Mainline Decision; it is not a Wakebook
product, privacy, migration, or browser failure.
