# Phase 3-4 Convergence Browser Matrix Risk Acceptance

**Exception ID:** `P34-BME-20260729`
**Decision:** explicit owner risk acceptance on 2026-07-29
**Scope:** Phase 3-4 cross-project convergence for Wayfarer, Sealed Hold, Harborlight, One Voyage, and Lanternwake.

## Decision boundary

The 316-case integrated Playwright matrix is not represented as a pass. Its retained run recorded **118 passed, 155 failed, 28 skipped, and 15 not run**. The active matrix runtime was stopped under the owner decision `FINAL_MATRIX_STOPPED_BY_OWNER_RISK_ACCEPTANCE`; its marker-owned artifacts remain preserved and the runtime lock/owned ports were released.

Promotion is authorized without restarting that matrix because independent evidence has already covered the changed product families. This is a bounded validation exception, not a claim that the uninterrupted matrix was green.

## Passed evidence retained by the convergence record

- Complete unit validation repeatedly passed, including the recorded 1080/1080 result; the targeted post-repair record also captures the then-current 1074-test suite.
- Formatting, lint with 81 existing warnings and zero errors, strict TypeScript, Voyagewright product-language, Project One Voyage architecture, animation ownership, and private-content/privacy scans passed in their recorded runs.
- SQLite Prisma generation plus fresh and upgrade migration rehearsals, projection/backfill verification, and a disposable MySQL migration/runtime/backup/restore/restart rehearsal passed. No canonical baseline database was used as a mutable validation target.
- Production builds passed. Ordered Chromium, Harborlight, and Wayfarer preludes; compact Chromium and WebKit sentinels; complete Chromium and WebKit-mobile family runs; and focused/affected-family repairs passed as recorded by their marker-owned artifacts.

The authoritative detail and artifact hashes are retained in `Project_Phase_3_4_Browser_Compatibility_Map.md` and the original convergence records. Those records distinguish fresh marker-owned runtimes from the retired fixed validation path.

## Repaired roots and independent proof

| Root                                                                | Repair and proof                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical Player readiness and obsolete Phase 3 overlay assumptions | Canonical Player presentation history, Journal-ready assertions, and focused/affected Chromium and WebKit-mobile viewport-family evidence.                                   |
| Invitation route race and duplicate lifecycle ownership             | Start the authoritative acceptance operation from the visible action, avoid a spent-route refresh, and prove focused invitation/Captain-to-Player handoff tests.             |
| PageFlip geometry at zoom and fallback handling                     | Resize the single owned runtime without replacing it, preserve focus/current page, and prove focused PageFlip and Journal lifecycle tests.                                   |
| Accessibility table structure                                       | Give Captain invitation rows their required cell roles and prove the focused accessibility contract.                                                                         |
| Development first-route compilation and stale browser contracts     | Browser-session route prewarming plus current Captain, Studio, Voyagewright, Journal, and account-rooted session assertions; focused and family-level browser reruns passed. |
| Detached transition controls and transport interruptions            | Re-query optional controls and assert semantic settled states; affected-family Chromium/WebKit proof passed.                                                                 |

## Why the broad run is excepted

The retained failures were dominated by development-server first-route compilation, `ECONNRESET` transport interruptions, Playwright runner ordering, detached transition controls, stale validation setup assumptions, matrix-only readiness races, and harness argument/runtime orchestration. Focused reproduction showed the allegedly failing product cases to pass under their correct family setup. Reporter messages such as `step id not found` are recorded as secondary fallout unless independently reproduced.

## Mandatory Project Sounding Line remediation

Project Sounding Line must begin from the consolidated mainline and deliver durable test execution, impact-based validation, reusable evidence, root/cascade classification, route prewarming, runner isolation, resource ownership, governed test metadata, deterministic browser scheduling, and infrastructure-failure classification. It must retain the distinction between product regressions and matrix/harness failures; it may not reinterpret this exception as a 316/316 pass.
