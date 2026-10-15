---
title: SC-00C expanded Spatial Library browser evidence
audience: product-engineering
status: candidate-evidence
canonical_for: sc-00c-expanded-library-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# Expanded Spatial Library browser evidence

Initial reviewed source commit: `99738a6efb56e6c794bd91e841ca68542320e664` on the owned
combined SC-00C branch. The generic Sounding Line browser-suite runner built
that exact source, bootstrapped an isolated synthetic SQLite database and ran
`tests/e2e/parallax-sc00c-expanded-library.spec.ts` in production Chromium.
Both journeys passed; its receipt reports capture and cleanup `PASS`.

A separate generic-profile browser suite built the same source on a fresh
isolated database and passed **18 cases** across SC-00C Library browsing,
drag and surface placement, Scene/Environment lifecycle, and SC-07A Community
publication and installed-content return. The scale case was deliberately
skipped in that mixed suite and run separately on another fresh database.

That separate **2,000-Scene** production Chromium case passed **1/1** on that
source, with
10,000 indexed releases and no full release bodies in Studio bootstrap. Its
[measurement](99738a6efb56/scale-2000/browser-scale.json) records a 6,626,373
byte repeated authenticated bootstrap read, 4,136 ms to the Parallax heading,
a 26,371 byte first page of 48 cards, 936 ms far search, and 96 cards after
Show more. The 390 px phone document fit its viewport. These local timings
are observations, not latency promises. The complete Studio bootstrap remains
larger than the paged Library response; it is an explicit whole-Studio scale
limit. The [desktop](99738a6efb56/scale-2000/2000-scenes-desktop.png) and
[phone](99738a6efb56/scale-2000/2000-scenes-phone.png) captures show the
compact Library in that scale run.

## Current Harborlight and Parallax integration

The branch then merged the current SC-07A draft head
`8817a74700161da308e9088c72d472dbd0df7876` and protected main into
local commit `55a3dcccf380823d7abf8462467e3c4eda09a376`. The expanded
Library component, styles, inspector and browser test are byte-identical to
the reviewed `99738a6efb56` source; the merge adds Harborlight Profile
recovery and current integration infrastructure. A fresh generic-profile
production Chromium suite on the exact merged source passed **21/21** cases,
including both expanded Library journeys and all eight Community cases. Its
runner reported capture and cleanup `PASS`. Its unmodified
[runtime receipt](55a3dcccf380/browser-runtime.json),
[suite profile](55a3dcccf380/browser-suite-profile.json),
[last-run marker](55a3dcccf380/playwright-last-run.json) and
[merged-source captures](55a3dcccf380/) retain the visible Library and
Profile recovery states; that marker records pass status, not the case count.

The [exact-source Product Experience planning attempt](55a3dcccf380/experience-plan-blocked.log.txt)
stopped at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`.
No protected capture or merge followed. The 2,000-Scene measurements above
remain bound to the earlier unchanged Library implementation source; they are
not a whole-Studio performance receipt for the final merged source.

The seven screenshots and two recordings in
[`99738a6efb56`](99738a6efb56/) document compact-to-expanded browsing,
selected interactive model inspection, checked return to viewport placement,
selected inserted object, narrow desktop, light/reduced motion, and initial
and selected phone states. [`browser-runtime.json`](99738a6efb56/browser-runtime.json)
and [`browser-suite-profile.json`](99738a6efb56/browser-suite-profile.json)
are copies of the exact candidate's unmodified local runner receipts.

Independent screenshot-first review on the earlier `8f47d451c5a8` capture
found the Place action too quiet, the phone's empty detail prompt ahead of
content, and category tab semantics without arrow keys. The repaired
`99738a6efb56` captures received independent re-review with no remaining
concrete blocker in the supplied images. The category buttons now have
roving tab focus, arrow/Home/End operation and a linked panel. This review is
bounded to captured states, not owner visual acceptance or all Library kinds.
The desktop capture shows Source, Show and Sort as one short toolbar above the
gallery. Narrow desktop and phone captures show content directly below the
search and navigation region.

The first `15ac68611bf5` journey run passed but revealed a narrow-layout
gallery gap and footer collision on screenshot inspection. A `9cf36bc69e50`
rerun caught the remaining gallery gap (219 px from search to first card).
The `d6c99c601894` attempt passed the placement journey but stopped in the
layout test on a test-only `getByLabel("Source")` locator. Those attempts are
not substituted for this final exact-source receipt.

Protected Product Experience capture still waits on the separately owned
Crossdeck Phase 2 continuity design contract. This folder records task-local
browser evidence only; it does not claim protected integration, live photo
accuracy, physical AR validation or owner acceptance.
