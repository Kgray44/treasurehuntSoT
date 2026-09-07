---
title: Voyagewright Brightwork Journal Pending Reproduction Record
audience: engineering-evidence
status: current
canonical_for: voyagewright-brightwork-journal-pending-reproduction
last_reviewed: 2026-09-07
---

# Voyagewright Brightwork Journal Pending Reproduction Record

## Purpose and baseline

This record independently rechecks Stage 7 pending observations `BW-PEND-001` (opening-ceremony failure) and `BW-PEND-002` (page-3-to-4 Next failure after fallback) against protected product source `87ce8a959ceca056c3e91304b0aa7dcf64fde649`. It is an audit reproduction, not a product-repair authority.

The focused runner used audit source `2599d694f132e87eab23ee580fb45fddeb9e6f13`, profile `lanternwake-phase3`, a fresh nonce-bound task-owned SQLite file, a built Next production server, and a task-owned loopback cookie adapter. Its browser endpoint was `http://127.0.0.1:3200` for the duration of the run.

## Invocation history

| Attempt                                    | Outcome                                                                                                                                                                                                                                                                                    | Classification                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Direct audit-server Playwright invocation  | Rejected at `/api/dev/validation/database-identity`: the audit hostname guard returned `421` for the default loopback Host, and the production audit build did not expose the test-only validation endpoint (`404`) when sent the audit Host. No Journal product assertion ran.            | `ENVIRONMENT_LIMITED`, not product evidence.                |
| First dedicated profile invocation         | The runner's filename preflight rejected a six-digit time segment. No fixture, build, server, or browser test ran.                                                                                                                                                                         | `SUITE_FIXTURE_CONTRACT_UNSATISFIED`, not product evidence. |
| Second dedicated profile invocation        | Prisma regeneration could not rename the query engine while the completed-corpus audit server held it open. The owned corpus server (PID 16192, port 3112) was verified healthy, then stopped through `brightwork:audit:stop`; no shared process was touched. No Journal browser test ran. | `ENVIRONMENT_LIMITED`, not product evidence.                |
| Authoritative dedicated profile invocation | Fixture setup passed, production build passed, readonly setup passed, and the Journal suite completed.                                                                                                                                                                                     | Evidence below.                                             |

## Authoritative browser result

The runner executed 12 Chromium lifecycle cases:

- 11 passed, including listener/request cleanup; full/short opening control and focus restoration; reduced-motion deterministic readiness; repeated replay resource cleanup; keyboard/PageFlip turns; missing actor/infinite CSS fallback; PageFlip readiness interruption; and all three dynamic-import/runtime-init/readiness-probe failure fallbacks.
- The twelfth case, completed archive replay, reached the expected historical mode, auto-opened quiet final pose, zero active event sources, visible completed-archive status, replay controls, and a visible historical volume aside. It failed only on the stale locator assertion `page.locator(".historical-lock")`.

The generic browser-authority receipt records `PRODUCT_FAILURE` because Playwright exited nonzero. That receipt is preserved rather than rewritten. The audit classification below is narrower and evidence-based.

## Source/render reconciliation for the stale assertion

Wave 6 commit `e5bcfb81f5118c823914588140416d5d504619db` intentionally removed the historical branch of `.chronicle-objective-tray`, including `<span className="historical-lock">Read-only ...</span>`, and introduced `<aside className="journal-historical-volume" aria-label="Historical volume information">`. The current aside says: “This completed Voyage is read-only and remains bound to the exact edition this Crew experienced.”

The browser test's `.historical-lock` expectation predates that product change and was not updated. The preserved screenshot therefore shows a product-visible, labeled, read-only historical surface and no `.historical-lock` node. This is `TEST_EVIDENCE_DRIFT`, not a demonstrated loss of the completed archive's read-only behavior.

## Pending-finding disposition

| Pending ID  | Evidence result                                                                                                                                                                 | Updated status                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| BW-PEND-001 | The normal/fallback lifecycle cases—including the missing actor and infinite CSS timing case—settled into readable final poses without reproducing the Stage 6 opening failure. | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` |
| BW-PEND-002 | The PageFlip control/keyboard, interruption, and failure-fallback cases passed without reproducing a stuck page 3-to-4 Next transition.                                         | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` |

The suite explicitly skips non-Chromium because its unique mutable voyage fixture is Chromium-only. This record does not claim WebKit, public deployment, real player, or owner acceptance coverage. It also does not authorize any Journal repair.

## Preserved evidence

- Browser profile/runtime receipt: `Journal_Independent_Browser_Receipt.json`.
- Screenshot: `Experience_Images/Final_Attention/Journal_Historical_Read_Only_Selector_Discrepancy.png`.
- Error-context snapshot originally emitted by the focused runner confirms the labeled Historical volume complementary region and its read-only text.

The screenshot contains only synthetic data and is retained to make the source/test divergence independently reviewable.
