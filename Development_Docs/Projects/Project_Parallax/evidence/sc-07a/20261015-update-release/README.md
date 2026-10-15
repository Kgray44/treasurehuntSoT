---
title: SC-07A immutable Community update browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-immutable-update-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A existing-listing update

The six-case [SC-07A Community browser suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts) passed on exact code/test source `3e5b17191fb938fa0a2b65f70e1f796287cce5b8` using Sounding Line's generic task-owned SQLite and production Chromium profile. The [full suite log](six-case-browser.log.txt) retains build, test, browser authority and cleanup output. Its new case created an approved 1.0.0 spatial asset listing, edited the private source, selected the existing listing through the same Studio wizard, submitted an immutable 2.0.0 release for moderation, approved it separately, and opened the actual updated Community listing. Database assertions kept the first release's package checksum unchanged before and after the second approval.

On successor source `2fec0a24579e5b611b157a2113de3e0b83545e2b`, the [focused update rerun](update-focused-browser.log.txt) passed after the test also changed the listing description and waited for the visible Community relationship panel to settle. Its [suite receipt](browser-suite-profile.json), [authority receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) retain the profile and cleanup outcome. [Pending 2.0.0 moderation](updated-release-pending-review.png) and the [approved 2.0.0 listing](updated-release-listing.png) are actual rendered captures from the focused run. The listing shows the revised description, the pinned install action and its release version.

These are local browser and database checks on synthetic content. The six-case pass belongs to `3e5b17191`, and the later one-case pass belongs to `2fec0a245`; they are not one six-case run on the successor source. The captures do not establish external scanner operation, physical-device behavior, independent Product Experience review, protected Sounding Line acceptance or owner product acceptance. The formal planner on current protected main still stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
