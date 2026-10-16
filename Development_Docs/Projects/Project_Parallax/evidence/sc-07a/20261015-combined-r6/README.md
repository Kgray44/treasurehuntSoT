---
title: SC-07A combined R6 local browser rehearsal
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-combined-r6-local-rehearsal-20261015
last_reviewed: 2026-10-15
---

# SC-07A combined R6 local browser rehearsal

This **unmerged local candidate** joins SC-07A draft `7c3f76b641a1e6021bc2637c094834f099acb325`, Crossdeck draft `19687c12e20ef69e6519903b14e56a145df2d7e7`, and root Parallax draft `325a0c5d2f37ee975d16527960048815ee8edcf9` at `8f1e87ac25602b9bf2291e73c0174eddc11509ad`. Protected main was `a2495fd14efd5ade67832e18fd260f32da98b3b2`. The combined commit is a local integration rehearsal, not PR #736's head or a protected mainline candidate.

## Actual browser outcomes

- The fresh production Chromium [publishing and expanded Library run](16-journey-browser.log.txt) passed **16/16** journeys on the exact combined commit. Its [runtime receipt](16-journey-browser-runtime.json) reports capture and owned cleanup PASS. The [media manifest](16-journey-media-manifest.json) hashes 56 retained files.
- The separate fresh-database [2,000-Scene run](scale-browser.log.txt) passed **1/1**. The [report](scale-browser.json) records 10,000 indexed releases, a 48-card first page, one far-search match, and 96 cards after Show more. Its [runtime receipt](scale-browser-runtime.json) and [manifest](scale-manifest.json) bind the run and retained scale media to the same source.
- A third fresh-database [compact Library and drag-placement run](compact-browser.log.txt) passed **4/4**. Its [runtime receipt](compact-browser-runtime.json) reports capture and cleanup PASS; the [manifest](compact-evidence-manifest.json) hashes the retained compact and placement media.

The ordinary Creator journey starts with a private saved Scene in the Scenes Library. [The first wizard step](natural-studio-content.png) now explains above the fixed footer that a Scene without a pinned Environment publishes its self-contained content as a Spatial asset. [Server package review](natural-studio-package-review.png) repeats the resulting release type and install behavior before submission. The browser case asserts the first explanation is visible above the footer. An independent local reviewer inspected both captures and the recording, resolving the earlier desktop discoverability finding. This specific explanation has not been independently captured on a phone viewport.

The [approved Community listing](asset-listing-desktop.png) exposes the exact release and install action. [Installed Library details](asset-installed-details.png) identify the pinned read-only release and rights. The [mobile refusal](rights-refusal-mobile.png) keeps unlicensed physical content private. Each copied screenshot and the scale JSON match the SHA-256 entries in the retained manifests.

The full media archives remain on the task-owned D: drive at `D:\CodexTaskOutputs\sc07a-triple-browser-20261015-r6`, `D:\CodexTaskOutputs\sc07a-triple-scale-20261015-r6`, and `D:\CodexTaskOutputs\sc07a-triple-compact-20261015-r6`. Tests used synthetic identities and content, strict task-owned SQLite databases, a production build, and owned browser/server ports. The [owner review route](../../../SC_07A_Combined_Adaptation_20261015.md) maps the brief's twelve journeys and separate privacy checks.

## Acceptance boundary

The exact-base Product Experience planner on SC-07A PR head `7c3f76b641a1e6021bc2637c094834f099acb325` stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration` while protected main lacks the separately owned Crossdeck product design. The local three-way comparison against main also includes broad draft Parallax changes and cannot substitute for a fresh plan after protected dependencies land. These browser runs do not establish formal Product Experience review, protected Sounding Line qualification, real-device presentation, live scanner-provider behavior, safety of an actual home layout, or owner acceptance.
