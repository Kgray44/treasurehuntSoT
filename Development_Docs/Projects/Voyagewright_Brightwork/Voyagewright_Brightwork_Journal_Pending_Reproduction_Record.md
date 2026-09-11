---
title: Voyagewright Brightwork Journal Pending Reproduction Record
audience: engineering-evidence
status: current
canonical_for: voyagewright-brightwork-journal-pending-reproduction
last_reviewed: 2026-09-11
---

# Voyagewright Brightwork Journal Pending Reproduction Record

## Purpose

This record keeps two facts distinct: the historical pre-correction evidence run that exposed a stale selector, and the final focused product lane that repaired that test evidence. Neither result authorizes a Journal product change.

## Historical pre-correction receipt — retained, not rewritten

The earlier current-main audit used protected product `87ce8a959ceca056c3e91304b0aa7dcf64fde649`, audit runtime `2599d694f132e87eab23ee580fb45fddeb9e6f13`, profile `lanternwake-phase3`, a fresh nonce-bound task-owned SQLite fixture, a built Next production server, and a loopback cookie adapter.

It ran 12 Chromium lifecycle cases. Eleven passed. The completed-archive replay case entered historical mode, showed the completed archive/read-only state, replay controls, and the labeled Historical Volume, but then failed on obsolete implementation locator `.historical-lock`. The original generic runner receipt remains `FAIL` / `PRODUCT_FAILURE` because Playwright exited nonzero. Source and rendered evidence correctly classified that narrower discrepancy as `TEST_EVIDENCE_DRIFT`, not a demonstrated product regression.

The preserved screenshot under `Experience_Images/Final_Attention/` is historical synthetic evidence for that result. It shows the visible read-only treatment that the obsolete locator did not target.

## Final focused lane — repaired test evidence

The bounded final correction changed only the stale browser assertion to the current semantic contract: historical mode, a visible labeled Historical Volume, explicit completed-voyage read-only communication, available replay controls, and a readable Journal.

| Field                   | Result                                                     |
| ----------------------- | ---------------------------------------------------------- |
| Candidate               | `43b7d4b78109cdad2ffaae136b63cda6e1288870`                 |
| Protected product merge | `d2fe25355ed2e5eac47aefb9cc0152413b8b607f` (#654)          |
| Profile                 | `lanternwake-phase3`                                       |
| Browser scope           | Task-owned Chromium production-browser lane                |
| Result                  | 12 passed / 0 failed                                       |
| CI confirmation         | Sounding Line / Mainline Decision run `34637475779` — PASS |
| Disposition             | `TEST_EVIDENCE_REPAIRED_AND_VERIFIED`                      |

The final test repair did not alter PageFlip, opening ceremony, replay, readiness, fallback, reduced-motion handling, or historical-mode behavior.

## Pending-finding disposition

| Pending ID    | Current outcome                         | Boundary                                                                                                         |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BW-PEND-001` | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` | The final lane includes normal/fallback lifecycle coverage but is not WebKit, live-environment, or owner proof.  |
| `BW-PEND-002` | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` | Page-turn, interruption, and failure-fallback coverage passed; this is not authority for Journal product repair. |

The unique mutable voyage fixture explicitly skips non-Chromium browsers. No public deployment, real-player, production-data, or owner acceptance claim follows from this record.
