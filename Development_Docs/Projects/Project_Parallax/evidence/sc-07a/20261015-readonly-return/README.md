---
title: SC-07A read-only Library return evidence
audience: product-engineering
status: validation-evidence
canonical_for: parallax-sc-07a-readonly-return-browser-evidence
last_reviewed: 2026-10-15
---

# SC-07A read-only Library return

Product source: `a7e0967d3813d9e469ffef01828892b361ff5c47` on `codex/parallax-sc07a-core-adaptation`. This is unmerged branch evidence. The production [build](production-build.log.txt) and [48 focused tests](focused-tests.log.txt) passed on the product source using task-owned validation state. The final [SC-07A browser run](spatial-browser.log.txt) passed all five Chromium journeys against a freshly bootstrapped, isolated SQLite database and the built application on port 3237. It exercised saved-private versus submitted-public state, exact package review, distinct moderation, installation, rich Environment and Scene pins, rights refusal, and uncertain-response retry.

The historical [combined attempt](combined-attempt-failed.log.txt) on pre-parity source `cbd23391c` passed both SC-00C Library journeys, then failed during the first SC-07A installed-return navigation. Chromium recorded `ERR_NETWORK_IO_SUSPENDED` for Studio resources and the Next server reported an early-closed destination stream; four later SC-07A journeys did not run in that attempt. The final source's [separate SC-00C run](library-browser.log.txt) and fresh isolated SC-07A run passed their respective two and five journeys. These are two separate successful subsets, **not** one uninterrupted seven-journey pass. The [last-run result](playwright-last-run.json) belongs to the successful five-journey run.

| Journey | Actual application capture |
| --- | --- |
| Private saved asset and narrow mobile publishing entry | [asset source](asset-source-mobile.png) |
| Explicit submission before moderation | [submitted asset](asset-submitted-desktop.png) |
| Approved Community listing | [public listing](asset-listing-desktop.png) |
| Second Creator's selected installed release beyond the first 48 Library cards | [desktop return](asset-installed-desktop.png), [exact detail](asset-installed-details.png), [mobile return](asset-installed-mobile.png) |
| Pinned Scene dependency review | [Scene package](scene-package-review.png) |
| Rich Environment package and installed read-only copy | [review](environment-review-desktop.png), [installed detail](environment-installed-details.png), [desktop return](environment-installed-desktop.png) |
| Unlicensed physical content refusal | [mobile refusal](rights-refusal-mobile.png) |
| Lost submission response and explicit exact retry | [uncertain response](unconfirmed-response.png) |

An independent visual and interaction reviewer found that the earlier installed link opened a writable canvas with ambiguous ownership and that a deep link beyond the first catalog page lost release provenance. After repair and recapture, the reviewer found no remaining P1/P2 issue: Library details retain pinned version, readable license and credit; the canvas says **Separate working Scene**. A final narrow review confirmed the installed Environment now says **1 immutable version · Installed Community copy** instead of exposing `LEGACY_REVIEW`.

The browser used synthetic accounts and content. It establishes local rendered behavior, not protected Sounding Line qualification, real-device behavior, scanner-provider operation, or owner acceptance. The failed combined attempt remains visible for diagnosis.
