---
title: SC-07A generic-profile keyboard publication evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-generic-keyboard-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A keyboard publication on the canonical isolated profile

Exact candidate `649cafcd55a9f33ad09f514d08629da289a6a54e` adds keyboard activation of the Creator rights acknowledgment, Environment privacy acknowledgment, package review acknowledgment, and final Submit to Community action in the five-case [SC-07A Community browser suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts). The test still starts from a privately saved source, uses Harborlight's actual review and moderation path, and verifies installation, privacy refusal, and exact retry. `npm run typecheck` passed before the browser run.

Sounding Line's **generic** task-owned isolated profile built the production application and passed all five Chromium cases on this candidate. The [suite receipt](browser-suite-profile.json), [browser authority and cleanup receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) retain the run status. The server, proxy, and browser cleanup was observed as `PASS`; the backend server required owned-process escalation, and its tree and ports were reported reaped and released. These receipts do not represent protected Mainline Decision or Product Experience review.

Actual rendered captures from that run include the [390 px saved-source dialog](asset-source-mobile.png), [keyboard-submitted pending state](asset-submitted-desktop.png), [Scene package review](scene-package-review.png), [mobile rights refusal](rights-refusal-mobile.png), and [uncertain-response recovery](unconfirmed-response.png). The submitted state truthfully says moderation is next; it does not show an approved listing before review.

The suite demonstrates the named keyboard actions in Chromium and one mobile focus-containment check. It does not certify all keyboard paths, physical devices, external scanner operation, Product Experience completion, protected Sounding Line acceptance, or owner acceptance. The candidate's formal planner still encounters `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity` on protected main `48296fbf23b8c90f5ebf9d20ebc85b9d8c824d85`.
