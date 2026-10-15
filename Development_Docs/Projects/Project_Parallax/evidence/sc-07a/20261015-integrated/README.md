---
title: SC-07A integrated browser evidence
audience: product-engineering
status: validation-evidence
canonical_for: parallax-sc-07a-integrated-browser-evidence
last_reviewed: 2026-10-15
---

# SC-07A integrated browser evidence

Source commit: `bae94f5f1c8ccc5df6cb50fcbbc18019a89689b0` (`codex/parallax-sc07a-core-adaptation`), merging SC-07A with the current SC-00C Library candidate. This is an unmerged branch receipt, not a mainline or owner-acceptance claim.

The task-owned production build passed with `FOREVER_VALIDATION_ISOLATION=1` and the isolated SQLite database `D:/Codex_SC07A_Validation_20261015/validation-isolated-sc07a-combined-20261015.db`. The production Chromium run passed seven direct journeys: five SC-07A publication/recovery journeys and two SC-00C Library journeys. See [production build](production-build.log.txt), [browser output](browser-journeys.log.txt), and [Playwright result](playwright-last-run.json). The browser ran against the built Next.js app on task-owned port 3237 with synthetic accounts and content.

| Journey | Actual UI capture |
| --- | --- |
| Private saved source and narrow mobile wizard | [asset source](asset-source-mobile.png) |
| Moderation pending after explicit submission | [submitted asset](asset-submitted-desktop.png) |
| Approved Harborlight listing with exact-release installation | [public listing](asset-listing-desktop.png) |
| Second Creator's installed, read-only asset and provenance | [asset details](asset-installed-details.png) |
| Rich Environment package review and geometry warning | [Environment review](environment-review-desktop.png) |
| Second Creator's installed, read-only Environment | [Environment details](environment-installed-details.png) |
| Refusal of an unlicensed physical model at mobile width | [rights refusal](rights-refusal-mobile.png) |
| Transport response lost after submission, before exact retry | [unconfirmed response](unconfirmed-response.png) |

The [Scene package review](scene-package-review.png) proves the pinned Environment's reviewed dependency while excluding the private source photo label. The browser assertions also checked no private listing on save, distinct moderator approval, source/package immutability after a private edit, and one release after an exact retry. The mobile journey checked keyboard focus and reported no serious or critical Axe violations. Local Chromium cannot establish real-device, physical room, scanner-provider, independent product review, protected qualification, or owner acceptance.
