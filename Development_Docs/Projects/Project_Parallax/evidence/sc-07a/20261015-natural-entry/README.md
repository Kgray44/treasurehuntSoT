---
title: SC-07A natural Studio entry and Community package review evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-natural-studio-community-review-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A natural Creator entry

The [seven-case SC-07A browser suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts) passed on exact code and test source `328bade8d30e811a6c5fe4d7132b4ffd44a6cbde`, which includes the SC-00C collection-filter integration. Sounding Line's generic profile built the production application, provisioned a fresh task-owned SQLite database and synthetic Creator, ran Chromium with one worker, and reported owned browser, proxy, server-tree and port cleanup `PASS`. The [full log](seven-case-browser.log.txt), [suite receipt](browser-suite-profile.json), [runtime receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) retain that outcome.

The added case signs in through the ordinary Creator entry, opens Spatial Studio, saves the default working definition privately, finds it in the Scenes Library, opens the contextual publishing wizard, reviews included content, rights and the server-verified package, closes the wizard, and returns to Creator Studio. Because this default definition has no pinned Environment, the reviewed Community package is classified as a spatial asset; the separately tested pinned-Environment route publishes as a Scene. Database assertions confirm that neither save nor package review creates a Community listing. The [rendered package-review capture](natural-studio-package-review.png) and [focused pass log](natural-entry-focused-pass.log.txt) are local evidence of that route. The previously passing six cases still cover actual Harborlight submission, moderation, listing, install, immutable update, refusal and retry.

The first natural-entry attempt at `9db898b5c` stopped at a test locator for the loading-screen title; the loaded editor correctly rendered the heading “Parallax.” Its [failed log](natural-entry-attempt1-failed.log.txt) is retained and is not counted as a pass. The SC-07A semantic Product Experience contract was then adjusted to use a visible Studio outcome meeting the planner's minimum outcome-text requirement. The contract correction at `5f6496e52c10f2b59f1171407d870167615a2919` did not change product code or browser tests.

The [formal planner log](experience-plan-blocked.log.txt) at that contract-corrected source stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`, a separately owned protected-base obligation. The SC-07A contract has therefore been registered and locally validated, but formal capture/replay, independent Product Experience review and protected Sounding Line acceptance remain open. Synthetic browser proof does not establish real-room safety, physical-device behavior or owner product acceptance.
