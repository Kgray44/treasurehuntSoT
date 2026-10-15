---
title: SC-07A immutable Community update browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-immutable-update-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A existing-listing update

The six-case [SC-07A Community browser suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts) passed on exact integrated code/test source `1d92a903f31f45071ce50434e69caf3b3389da0a`, including SC-00C's collection-filter changes. Sounding Line's generic task-owned SQLite and production Chromium profile built the application, ran all six cases with one worker, and reported owned browser, proxy, server-tree and port cleanup `PASS`. The [integrated full log](integrated-six-case-browser.log.txt), [suite receipt](integrated-browser-suite-profile.json), [authority receipt](integrated-browser-runtime.json), and [Playwright result](integrated-playwright-last-run.json) retain that outcome.

The new journey created an approved 1.0.0 spatial asset listing, edited the private source, selected the existing listing through the same Studio wizard, submitted an immutable 2.0.0 release for moderation, approved it separately, and opened the actual updated Community listing. The Creator changed the public description; database assertions kept the first release's package checksum unchanged before and after the second approval. Actual integrated captures show [pending 2.0.0 moderation](integrated-updated-release-pending-review.png) and the [approved 2.0.0 listing](integrated-updated-release-listing.png) with the revised description, visible release fact and pinned install action.

Two earlier integrated runs at `ceb737975` and `4388fdcbb` stopped at ambiguous test locators for the release text because the page rendered more than one correct 2.0.0 value. Their [first](integrated-attempt-selector-failed.log.txt) and [second](integrated-attempt-duplicate-fact-failed.log.txt) failed receipts are retained; neither is counted as a pass. The preceding local six-case run at `3e5b17191` and focused one-case run at `2fec0a245` predated the SC-00C collection-filter integration. Their [full](six-case-browser.log.txt) and [focused](update-focused-browser.log.txt) logs, [older pending](updated-release-pending-review.png) and [older listing](updated-release-listing.png) captures remain historical evidence, not the integrated candidate's proof.

These are local browser and database checks on synthetic content. The captures do not establish external scanner operation, physical-device behavior, independent Product Experience review, protected Sounding Line acceptance or owner product acceptance. The formal planner on current protected main still stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
