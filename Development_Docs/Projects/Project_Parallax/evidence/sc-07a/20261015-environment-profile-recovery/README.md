---
title: SC-07A Environment Profile setup return evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-environment-profile-recovery-evidence-20261015
last_reviewed: 2026-10-15
---

# Environment Profile setup return

The [nine-case production Chromium suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts) passed 9/9 on exact code and test source `dc3245b90a611e208cd79ef41927e9b79e403bfa`. Sounding Line's generic profile used a fresh task-owned SQLite database, production Next build, synthetic identities and one Chromium worker. The [full log](nine-case-browser.log.txt), [suite receipt](browser-suite-profile.json), [runtime receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) record the pass and owned browser, server-tree, proxy and port cleanup `PASS`. The copied terminal log has trailing whitespace removed for the repository diff; diagnostic lines and results are otherwise preserved.

The new case creates a privately saved synthetic Environment and an immutable version for a Creator whose public Profile is incomplete. Publishing is blocked at the first step without creating a Community listing. **Set up public Profile** opens the existing Profile editor. After the Creator saves a public handle, the return route selects the same Environment card and exact immutable version, and the same wizard can continue. The test checks the return URL, visible Library detail, selected version, enabled Continue action and absence of a listing. The [rendered return capture](environment-profile-return.png) shows the selected immutable version in the wizard.

This corrects the earlier Environment fallback to the general Studio route. Studio Profile returns are restricted to a saved definition or an Environment Library selection with a valid version identifier. The other eight cases still cover the canonical listing, moderation, installation, release update, private package projection, refusal, interrupted submission, ordinary Creator entry and asset Profile recovery. This local software pass does not establish formal Product Experience replay, protected Sounding Line qualification, physical-device behavior or owner acceptance. Crossdeck Phase 2 continuity remains a separately owned protected-base prerequisite.
