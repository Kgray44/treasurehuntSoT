---
title: SC-00C named Collection filter browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-00c-collection-filter-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# Named Collection filter in the unified Spatial Library

The exact local code and test source is `2ecf9790f6eb422b383bfd876430a71ee882087f`,
rebased on SC-07A draft PR #736 head `7d85bacd96e236f955592f1e20df55e615b9ba9a`.
This continuation is in the owned `codex/sc00c-collections-filter` branch; it
has not entered the shared PR or protected main. It adds a named Collection
selector to the existing owner-scoped, paged Library catalog. The selector
offers names from the current content kind, source, save state and Environment
scope. Filtering happens before pagination; changing the selected collection
invalidates the previous cursor. The full-data fallback uses the same filter.

The [production build](build.log.txt), TypeScript check and focused ESLint check passed on this
source. Fourteen focused catalog tests passed, including the owner-scoped
collection options, filtered result and stale-cursor case. On a fresh isolated
SQLite database, all [three direct production Chromium journeys](library-browser.log.txt)
passed. The [Collection screenshot](screenshots/2ecf9790f6eb/favorite-collection-filter.png)
shows one renamed Scene in its selected collection while its sibling is absent.
The same source captured [built-in asset insertion](screenshots/2ecf9790f6eb/built-in-asset-selected.png)
and [keyboard insertion at phone width](screenshots/2ecf9790f6eb/keyboard-context-add-phone.png).
The journeys used only synthetic Creator accounts and private loopback HTTP.

The fresh, source-bound [2,000-Scene browser run](scale-browser.log.txt) passed.
Its [JSON report](browser-scale.json) records five immutable releases per
synthetic Scene, 48 first-page cards in 26,371 bytes, 96 cards after Show more,
a 2,005 ms far-end search, keyboard detail inspection at a 210 px panel,
a 420 px panel and no document overflow at a 390 px phone viewport. The
[desktop](screenshots/2ecf9790f6eb-scale/2000-scenes-desktop.png),
[narrow-panel](screenshots/2ecf9790f6eb-scale/2000-scenes-narrow-panel.png) and
[phone](screenshots/2ecf9790f6eb-scale/2000-scenes-phone.png) captures are from
that run. These timings are observations from one local host, not a network or
device performance qualification.

The full Studio bootstrap still returned **23,990,373 bytes**. Heading readiness
was **11,006 ms** in the source-bound run. An earlier exploratory pass on the
same built code was faster (4,165 ms heading readiness, 958 ms far search),
showing local variability; its report omitted the source field and is retained
only under `artifacts/sc00c/collection-filter/`. The bootstrap's full release
load originates in `src/parallax/library-service.ts` (`listSpatialItems`) and
`src/parallax/library-lifecycle-service.ts` (`spatialLibraryInventory`), which
feed the general `/api/studio/parallax` response. The Library's compact catalog
endpoint stays paged, but this broader Studio cost remains open with SC-01's
Scene Manager owner. The SC-00C brief specifies responsiveness for hundreds or
thousands of items and no numeric byte or time budget; the local run cannot
establish final performance acceptance.

Protected Product Experience capture/review, Sounding Line qualification and
owner acceptance remain open. The planner currently stops at the separately
owned `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`
contract. SC-07A owns the Creator-to-moderator-to-installer visible replay
mapping. This local proof does not replace either gate.
