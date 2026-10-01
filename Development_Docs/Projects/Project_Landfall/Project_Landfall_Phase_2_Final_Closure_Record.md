---
title: Project Landfall Phase 2 final closure record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-final-closure
last_reviewed: 2026-09-30
---

# Phase 2 final closure correction

## Reconciliation of the earlier claim

The [original validation record](Project_Landfall_Phase_2_Validation_Record.md) asserted “FULLY CLOSED ON PROTECTED MAIN” after PR #669 and the #670 evidence follow-up. Those integrations and their evidence remain historical facts. The subsequent independent audit identified missing functional and acceptance depth in embedded Living Charts, two-stage observations, durable offline reload, Captain command coverage, physical Creator field walks, responsive layouts and accessibility. The earlier assertion is preserved; it is insufficient for final contract closure until this correction's protected completion gates pass.

## Correction identity and state

- Starting protected main: `b742c389da9f7bad1a42897fae688dbabe9acfa3` (includes #669 product merge and #670 evidence reconciliation).
- Owned branch: `codex/landfall-phase2-final-closure`.
- Product correction: [PR #671](https://github.com/Kgray44/treasurehuntSoT/pull/671); final candidate, hosted PASS, protected merge and landed smoke remain pending.
- Feature Catalog FT-044: reviewed; its meaningful offline/interaction limitation update is deferred until the product correction lands.

## Acceptance coverage

| Contract                 | Corrected behavior and proof                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Living Chart             | Real Passage map and Map drawer use one controller, released geometry and explicit foreground location. Controller tests cover watch ownership, revision, background and unmount cleanup. Completed/history maps have no location or writes.                                                                                        |
| Observation              | Matching block/world/waypoint canonical arrival unlocks a withheld prompt. Separate Player confirmation, text answer or configured Captain verification completes through normal progression. Prior visits need fresh observation context; weak evidence cannot consume stronger completion requirements.                           |
| Offline                  | Encrypted bounded IndexedDB chart/pages/assets and one delivery item; public data-free reload shell; tab/session/edition/CSRF capability; TTL/count/byte eviction; acknowledgement/rejection/logout clearing; reauthentication and exact sequence requalification; virtual image continuity; external tiles explicitly online-only. |
| Captain                  | Direct tests exercise all eight commands, authority, reason, override, sequence and idempotency. Production browser uses all eight reviewed controls, narrow layout and a preserved stale conflict. Exact Player position remains absent.                                                                                           |
| Creator                  | Actual panel accepts a native synthetic first fix and deterministic follow-up callbacks, saves a sanitized source-bound receipt, marks it stale after edit, rejects offline saving, and stops on selection/source/stop/unmount/permission changes.                                                                                  |
| Responsive/accessibility | Compact/common phone, tablet and desktop; narrow Captain/Creator; map text alternative; keyboard controls, drawer focus return, 200% text, forced colors, reduced motion and scoped axe scans.                                                                                                                                      |
| Compatibility            | All six block families, reusable completion on ordinary blocks, canonical arrival, hidden projection, safe replay, retained Phase 1 and Phase 2 production browser families.                                                                                                                                                        |

## Local correction qualification

- Production build: PASS, 148 static pages. Existing Node-in-Edge and dynamic NFT warnings are retained baseline warnings.
- Combined task-owned production browser: **24/24 PASS** (15 closure, four Phase 1 compatibility, five retained Phase 2) on the final functional source, including restored pending-evidence/shell status and compact tablet profile controls. Cleanup receipt: 38 ms, no infrastructure or product failure. All four Player viewports and scoped physical/virtual/Creator/Captain axe scans passed.
- Focused Landfall/command/controller suite: 19 files, 117 tests PASS; the subsequent revocation case and existing Journal/auth lifecycle tests passed as well. The command/progression file contains 41 tests, including all eight Captain transaction branches.
- Final unit qualification: **400 files / 2,262 tests PASS** (`vitest run --pool forks --maxWorkers 1`, 467.02 seconds) on final functional source, including the offline restored-status correction and tablet profile layout. The prior 461.59-second pass at `de8b26f1211e789d25c88bab940811d25a4e5d80` is retained only as intermediate evidence.
- TypeScript, affected ESLint, formatting, Drydock validation, One Voyage architecture, documentation index/validation, Feature Catalog sync/validation, repository/build/staged private-content scans and whitespace review: PASS.
- Earlier local qualification attempts are not completion proof: three existing Journal/auth regressions were corrected; a multi-thread full run's streaming RSS assertion failed because unrelated workers share the measured process, while its isolated focused retest passed. Browser fixture races were corrected without removing acceptance assertions.
- Initial hosted run `36796701731`, job `110161684267`, at `eadb6ec94984fa7a78132bcf4ed3608c60238f27` failed the tablet 200% text assertion: the profile control extended 13 pixels beyond the viewport with the hosted font metrics. Journal-scoped compact profile controls correct that overflow; the complete local browser suite passed before qualifying a revised head. The failed run is retained as a failure, not completion evidence.

## Evidence boundary

Fixtures use synthetic accounts, fictional maps and synthetic browser geolocation in a task-owned production runtime and isolated SQLite database. A native `watchPosition` first fix is counted separately from deterministic follow-up callbacks; no outdoor GPS, physical-device quality, external map-provider availability, production MySQL, deployment or owner acceptance is claimed. No schema migration is changed. Phase 3 Read the Ground, Phase 4 Hold the Bearing and the separate Watchglass project have not started.

## Protected completion gates

This record must receive the stable local unit/browser totals, exact candidate and PR, ordinary hosted Sounding Line PASS, protected merge identity, landed-tree smoke, final FT-044 reconciliation and final protected main identity before the classification becomes:

`FULLY CLOSED ON PROTECTED MAIN — POST-MERGE AUDIT CORRECTIONS COMPLETE`.
