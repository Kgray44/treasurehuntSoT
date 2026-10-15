---
title: SC-07A protected-main integration browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-protected-main-integration-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A protected-main integration

Draft PR #736 was reported conflicting with protected main after PR #731 landed. The owned SC-07A worktree merged protected source `9983c900875ffa116e7945318823e93e6e94348b` into candidate `749ddc2b484ea4f75a4d25a44037954adf9c0aa6`. The merge preserved both sets of raw-receipt Git attributes and regenerated the documentation inventory. It did not change the SC-07A product implementation.

The [eight-case browser log](eight-case-browser.log.txt) records `8 passed` on that exact merge commit using Sounding Line's generic task-owned isolated profile, a fresh SQLite database, a production Next build, synthetic identities and one Chromium worker. The [suite receipt](browser-suite-profile.json), [runtime receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) report `PASS`, including owned browser, proxy, server-tree and port cleanup. [Public listing](asset-listing-desktop.png), [server package review](scene-package-review.png), and [mobile Profile prerequisite](profile-required-mobile.png) are captures from this run. Copied terminal logs have trailing whitespace removed for the repository diff; their diagnostic lines and results are otherwise preserved.

The [formal planner result](experience-plan-blocked.log.txt) on the same source and protected base still stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`. Crossdeck PR #721 remains a separately owned draft. This browser pass proves the bounded synthetic product journeys after source integration; it does not establish formal Product Experience replay, protected Sounding Line acceptance, physical behavior or owner acceptance.
