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

The active SC-07A draft advanced again with a version-pinned Environment
return from public Profile setup. Its head `0ed48e878db5444e7e05a7d1d983fc9d2c68ec8e`
was merged into local candidate `73fe12a1b159c1846a8d91a926c0af0d39297568`.
A fresh production Chromium suite passed **22/22** cases on that source,
including the Environment version return, compact-to-expanded placement,
responsive Library layouts and the existing lifecycle and Community cases.
The [runtime receipt](73fe12a1b159/browser-runtime.json) and
[suite profile](73fe12a1b159/browser-suite-profile.json) report generic
capture and cleanup `PASS`; the [last-run marker](73fe12a1b159/playwright-last-run.json)
records pass status. The [final local captures](73fe12a1b159/) include the
expanded Library and Environment Profile return. The exact-source
[experience plan](73fe12a1b159/experience-plan-blocked.log.txt) still requires
the Crossdeck Phase 2 continuity design. No protected qualification or owner
acceptance is claimed.

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

## Expanded lifecycle and installed-content continuation

Exact source `3557eddd689fe13325eeff32240cb41fcefbb5bf` adds browser
coverage for an owned Environment and its pinned Scenes, canonical Scene
Manager creation/duplication, retained browsing context, and a read-only
installed Community release in both Library presentations. It also checks
that expanded placement returns to the same mounted Studio canvas, retains
the selected placed object and Undo history, and traps keyboard focus while
open. A thin details scrollbar makes lower contextual actions discoverable.

The generic production Chromium run passed **4/4** selected cases against a
fresh task-owned SQLite database. Its [runtime receipt](3557eddd689f/browser-runtime.json),
[suite profile](3557eddd689f/browser-suite-profile.json) and
[last-run marker](3557eddd689f/playwright-last-run.json) record capture and
cleanup `PASS`. The [desktop toolbar](3557eddd689f/expanded-desktop.png),
[Scene actions](3557eddd689f/expanded-scene-actions.png),
[installed release](3557eddd689f/asset-installed-expanded.png),
[phone](3557eddd689f/expanded-phone-selected.png) and
[placement return](3557eddd689f/placed-selected.png) are source-bound
captures. The selected installed release was beyond the first catalog page;
its detail panel still showed license and credit while withholding ownership
and publishing actions.

The first owned-Scene test attempt at `0d7c7259acd0` failed because its test
expected the original Scene to remain active after Duplicate; the canonical
Scene Manager opened the new copy. The preserved
[failure context](0d7c7259acd0/error-context.md) and
[run marker](0d7c7259acd0/playwright-last-run-failed.json) record that
test-expectation correction. These focused cases extend the earlier 22-case
combined receipt; they do not replace a final protected qualification.

## Current main and Harborlight heads

Local integration source `09bd7c9e1fe2b839f734b0d7be28deceb64605d4`
merges protected main `670706e875eeac61031f08f69595db2dc9a81879`
and the then-current SC-07A draft `0395e6d83a71f8a48818b3b0ff0ecf3167347143`.
The latter restores owned saved Effects to the paged Effects view and adds
Effect and Composition publication/installation journeys. The SC-00C
toolbar, shared catalog and placement source remained intact after merge.

On a fresh synthetic task-owned SQLite database, a generic production
Chromium run passed **14/14** expanded Library and SC-07A Community cases.
Its [receipt and captures](09bd7c9e1fe2/integration14/) include desktop,
phone, long Scene details, viewport placement and an installed release in
the expanded Library. A separate fresh-database run passed **25/25** cases
across expanded and compact Library, drag placement, saved-content lifecycle,
SC-01 Scene/Environment navigation and SC-07A publication. The
[runtime receipt](09bd7c9e1fe2/combined25/browser-runtime.json),
[suite profile](09bd7c9e1fe2/combined25/browser-suite-profile.json) and
[last-run marker](09bd7c9e1fe2/combined25/playwright-last-run.json) record
capture and cleanup `PASS` on that exact source.

The [exact-source Product Experience plan](09bd7c9e1fe2/experience-plan.log.txt)
still stops at
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
No protected capture, protected merge or owner acceptance followed.

## Two-thousand-Scene expanded browsing

The first scale test attempt at `57bbde755712358df54925ef23c9c0f20d8b3274`
expected 96 cards after clearing a search. The Library correctly resets the
page cursor on a filter change and returned to the first 48; the preserved
[failed receipt](57bbde755712-failed/browser-suite-profile.json) and
[screenshot](57bbde755712-failed/test-failed-1.png) show that test assumption.

Corrected test source `a02821a668b7f55982ed7f4848fe8786d6173d38`
passed **1/1** in an isolated production Chromium run with 2,000 synthetic
saved Scenes and five indexed releases per Scene. The [measurement](a02821a668b7-scale/browser-scale.json)
records a 48-card first page, 96 after Show more, 163 ms to open expanded
browsing with those 96 cards, a 938 ms expanded far-name search, one exact
detail read after opening, zero gallery canvases for Scene cards, and a 390 px
phone document within the 390 px viewport. The [desktop](a02821a668b7-scale/2000-scenes-expanded-desktop.png)
and [phone](a02821a668b7-scale/2000-scenes-expanded-phone.png) captures show
the expanded workspace at scale. The [runtime receipt](a02821a668b7-scale/browser-runtime.json),
[suite profile](a02821a668b7-scale/browser-suite-profile.json) and
[last-run marker](a02821a668b7-scale/playwright-last-run.json) record
capture and cleanup `PASS`.

The repeated authenticated Studio bootstrap was 6,626,373 bytes and heading
readiness was 3,508 ms in this local run. These observations establish
bounded local browsing behavior, not network/device latency or physical AR
performance. This continuation changed the scale test and evidence only; the
Library product source is the same as in the preceding integration run.

## Harborlight motion and reuse-rights merge

The active SC-07A draft then advanced to `9ff620ce95896f31729f08f8ac6a2c1cc44f3f38`,
retaining validated local animation tracks in published Effects and
Compositions and refusing unverified reusable-asset lineage. Local combined
source `e601b1e07d648c6f52520709f0933ba633445777` merges that draft
without changing the SC-00C expanded Library presentation. A fresh isolated
production Chromium run passed **14/14** expanded Library and Community
cases. Its [runtime receipt](e601b1e07d64-integration14/browser-runtime.json),
[suite profile](e601b1e07d64-integration14/browser-suite-profile.json),
[last-run marker](e601b1e07d64-integration14/playwright-last-run.json),
[desktop capture](e601b1e07d64-integration14/expanded-desktop.png) and
[installed release capture](e601b1e07d64-integration14/asset-installed-expanded.png)
bind the result to that source. The earlier 25-case coexistence and
2,000-Scene measurements retain their own source identities; they are not
rerun claims for this Harborlight merge.

## Camera and unsaved-edit round trip

Test-only source `d53f7387c4aa0419f9ad18215d6023a46a5d41d7` extends the
compact-to-expanded placement journey to check the projected camera before,
during and after Library use. It also edits the selected placed object's name
without saving, confirms the stored draft is unchanged, and confirms the edit
and Undo remain after closing and reopening the expanded Library. The same
isolated production Chromium run passed **3/3** expanded Library journeys;
its [runtime receipt](d53f7387c4aa-camera-unsaved/browser-runtime.json),
[suite profile](d53f7387c4aa-camera-unsaved/browser-suite-profile.json),
[last-run marker](d53f7387c4aa-camera-unsaved/playwright-last-run.json) and
[desktop capture](d53f7387c4aa-camera-unsaved/expanded-desktop.png) bind that
result to the test source. Capture and cleanup report `PASS`.

The earlier `491022a7dc84` and `62463bc5db47` attempts used the Guided
authoring mode, which does not expose the renderer's projected-camera test
attribute. Their [first](491022a7dc84-camera-wait-failed/error-context.md)
and [second](62463bc5db47-camera-mode-failed/error-context.md) failure
contexts and receipts are retained. The passing journey selects Engineering
mode before reading that diagnostic. Product Library code did not change in
this continuation. Protected Product Experience review and owner acceptance
remain open.

## Reviewed Harborlight package presentation integration

The active SC-07A head `a0f25acdad4951266f19c5acd0fc4192ef11eef4`
adds a readable, server-reviewed list of included effects, behavior rules and
animation tracks before Community submission. Combined source
`9420c76d44a8cb38a8bfe58b276d6af9e022da44` merges that work with the
expanded Library and its camera/unsaved-edit journey. A fresh isolated
production Chromium suite passed **14/14** expanded Library and SC-07A
Community cases; its [runtime receipt](9420c76d44a8-integration14/browser-runtime.json),
[suite profile](9420c76d44a8-integration14/browser-suite-profile.json),
[last-run marker](9420c76d44a8-integration14/playwright-last-run.json),
[desktop capture](9420c76d44a8-integration14/expanded-desktop.png) and
[phone capture](9420c76d44a8-integration14/expanded-phone-selected.png)
record that source. Capture and cleanup report `PASS`. The desktop capture
shows Source, Show and Sort in the compact toolbar above the gallery. This
generic run does not confer protected Product Experience or owner acceptance.

## Current combined Library journey suite

Candidate `db684d89a207ab9f7ebb4040c245f35d7a1cf9d0` adds only evidence
after the `9420c76d44a8` reviewed-package merge. A fresh task-owned SQLite
database and production Chromium run passed **25/25** cases across compact and
expanded Library browsing, physical drag and checked placement, saved-content
and Scene/Environment lifecycle, keyboard and theme layouts, and SC-07A
publication and installation. Its [runtime receipt](db684d89a207-full25/browser-runtime.json),
[suite profile](db684d89a207-full25/browser-suite-profile.json),
[last-run marker](db684d89a207-full25/playwright-last-run.json),
[expanded desktop](db684d89a207-full25/expanded-desktop.png),
[built-in placement](db684d89a207-full25/built-in-asset-selected.png),
and [associated Scenes](db684d89a207-full25/associated-scenes.png) bind
the observations to this candidate. Generic capture and task-owned cleanup
both report `PASS`. The 2,000-Scene scale measurements above retain their
earlier source identity; protected Product Experience and owner acceptance
remain open.

## Current protected-main and licensed-reuse merge

Combined source `fe5064bc17824c5e97b595d72ad0d8b0755a3f8e` merges
protected main `aaef39a57d2c89ca57136dce327d337c5cb0ef7f` and the
SC-07A licensed installed-Asset/Composition reuse head
`d17873fc315bb9847a31ffc54e5adbac7637df7a`. The import conflicts were
resolved while keeping SC-00C's paged Library source and the new server-side
reuse-rights check. A fresh isolated production Chromium run passed **25/25**
compact and expanded Library, placement, lifecycle and Community journeys,
including permitted installed Composition reuse and read-only/license refusal.
Its [runtime receipt](fe5064bc1782-full25/browser-runtime.json),
[suite profile](fe5064bc1782-full25/browser-suite-profile.json),
[last-run marker](fe5064bc1782-full25/playwright-last-run.json),
[expanded desktop](fe5064bc1782-full25/expanded-desktop.png) and
[placed selection](fe5064bc1782-full25/placed-selected.png) bind the result
to that source. Generic capture and task-owned cleanup report `PASS`.
Protected Product Experience qualification and owner acceptance remain open.

## Current-source two-thousand-Scene scale

The same `fe5064bc17824c5e97b595d72ad0d8b0755a3f8e` product and test
source passed a separate **1/1** isolated production Chromium run with 2,000
synthetic saved Scenes and 10,000 indexed releases. The [measurement](fe5064bc1782-scale2000/browser-scale.json)
records a 48-card first page, 96 after Show more, 225 ms local expanded open
with 96 cards, one exact detail read, zero Scene gallery canvases, 959 ms local
expanded far search, and a 390 px phone document within its viewport. The
repeated authenticated Studio bootstrap was 6,626,373 bytes and heading
readiness was 6,670 ms; both remain whole-Studio scale observations rather
than network or device promises. The [runtime receipt](fe5064bc1782-scale2000/browser-runtime.json),
[suite profile](fe5064bc1782-scale2000/browser-suite-profile.json),
[last-run marker](fe5064bc1782-scale2000/playwright-last-run.json),
[expanded desktop](fe5064bc1782-scale2000/2000-scenes-expanded-desktop.png)
and [expanded phone](fe5064bc1782-scale2000/2000-scenes-expanded-phone.png)
bind that pass to the current merged source. Generic capture and cleanup
report `PASS`.

## Final compact toolbar refinement

Product and test source `780b8a76dc3cdf28178a036e66c57cc92c15c676`
keeps the Scene Environment filter on the same short desktop toolbar as
Source, Show and Sort. The expanded view no longer reserves a separate filter
row. The 2,000-Scene test asserts that Source and Environment align above the
gallery. Its separate isolated production Chromium run passed **1/1** with
48 cards on the first page, 96 after Show more, one selected detail read,
zero Scene gallery canvases and a 390 px phone document in its viewport.
The [scale measurement](780b8a76dc3c-scale2000/browser-scale.json),
[runtime receipt](780b8a76dc3c-scale2000/browser-runtime.json),
[suite profile](780b8a76dc3c-scale2000/browser-suite-profile.json),
[last-run marker](780b8a76dc3c-scale2000/playwright-last-run.json),
[desktop capture](780b8a76dc3c-scale2000/2000-scenes-expanded-desktop.png)
and [phone capture](780b8a76dc3c-scale2000/2000-scenes-expanded-phone.png)
bind the result to that source. The repeated authenticated full Studio
bootstrap remains 6,626,373 bytes and took 5,322 ms locally; these are
whole-Studio observations rather than network or device promises.

The same source then passed a fresh **25/25** compact/expanded Library,
placement, saved lifecycle and Community production Chromium suite, including
the SC-07A licensed reuse path. Its [runtime receipt](780b8a76dc3c-full25/browser-runtime.json),
[suite profile](780b8a76dc3c-full25/browser-suite-profile.json),
[last-run marker](780b8a76dc3c-full25/playwright-last-run.json),
[Scene toolbar](780b8a76dc3c-full25/expanded-scene-actions.png),
[narrow desktop](780b8a76dc3c-full25/expanded-narrow.png),
[phone](780b8a76dc3c-full25/expanded-phone.png) and
[placed selection](780b8a76dc3c-full25/placed-selected.png) show the
responsive result and authoring return. Generic capture and task-owned
cleanup report `PASS` for both runs. Protected Product Experience review and
owner acceptance remain open.

## Harborlight saved-Asset reuse coexistence

Combined source `22a7340a57558f14064e13d458598c996890fef3` merges the
SC-07A Asset-reuse correction at `c6ac2f5f3a0acfa6c8d96ddcf5668ecbb28960e0`
into the refined expanded Library. A fresh isolated production Chromium suite
passes **25/25** compact/expanded Library, placement, lifecycle and Community
journeys, including the second Creator's credited copy of an installed saved
Asset and the read-only origin. The [runtime receipt](22a7340a5755-full25/browser-runtime.json),
[suite profile](22a7340a5755-full25/browser-suite-profile.json),
[last-run marker](22a7340a5755-full25/playwright-last-run.json),
[Scene toolbar](22a7340a5755-full25/expanded-scene-actions.png),
[phone](22a7340a5755-full25/expanded-phone.png) and
[placed selection](22a7340a5755-full25/placed-selected.png) bind the result
to that exact source. Generic capture and task-owned cleanup report `PASS`.
The separate 2,000-Scene performance run remains bound to the prior
`780b8a76dc3c` source. Protected Product Experience and owner acceptance
remain open.

## Current Harborlight review-label integration and scale retry

Combined product and test source `ad9283e8a7f16d08d9ddc13200786d9839fe6a0c`
merges the settled SC-07A package-review labels at
`cb7f5f37699428e9ccae46a6099505fa81790eeb` and corrects a mobile scale
test timing assertion. The first 2,000-Scene attempt on product source
`22a7340a5755` failed when it measured the expanding overlay at 388.89 px
against a 389 px threshold during its 180 ms entry animation. The
[failed runtime receipt](22a7340a5755-scale2000-first-failure/browser-runtime.json),
[last-run marker](22a7340a5755-scale2000-first-failure/playwright-last-run.json)
and [in-transition frame](22a7340a5755-scale2000-first-failure/expanded-phone-during-entry.png)
are retained. The test now polls for the settled viewport width, so a real
persistent width defect would still fail.

The corrected exact-source 2,000-Scene production Chromium run passed **1/1**.
Its [measurement](ad9283e8a7f1-scale2000/browser-scale.json) records a
48-card first page, 96 cards after Show more, one selected detail read, zero
Scene gallery canvases, 227 ms local expanded open, 954 ms local far-title
search and a 390 px phone document within its viewport. The repeated
authenticated full Studio bootstrap was 6,626,373 bytes and reached its
heading in 5,014 ms locally. The [runtime receipt](ad9283e8a7f1-scale2000/browser-runtime.json),
[suite profile](ad9283e8a7f1-scale2000/browser-suite-profile.json),
[last-run marker](ad9283e8a7f1-scale2000/playwright-last-run.json),
[desktop](ad9283e8a7f1-scale2000/2000-scenes-expanded-desktop.png) and
[phone](ad9283e8a7f1-scale2000/2000-scenes-expanded-phone.png) captures bind
those local observations to the combined source.

The same source passed a separate fresh **25/25** production Chromium suite
covering compact and expanded Library, placement, saved lifecycle, installed
Asset and Composition reuse, and Creator-facing Community package review.
Its [runtime receipt](ad9283e8a7f1-full25/browser-runtime.json),
[suite profile](ad9283e8a7f1-full25/browser-suite-profile.json),
[last-run marker](ad9283e8a7f1-full25/playwright-last-run.json),
[Scene toolbar](ad9283e8a7f1-full25/expanded-scene-actions.png),
[narrow desktop](ad9283e8a7f1-full25/expanded-narrow.png),
[phone](ad9283e8a7f1-full25/expanded-phone.png) and
[placed selection](ad9283e8a7f1-full25/placed-selected.png) capture the
result. Both passing runs report generic capture and owned cleanup `PASS`.
The bootstrap and timing figures are whole-Studio local observations, not
network or device promises. Protected Product Experience and owner acceptance
remain open.

## Current stacked Harborlight mobile review assertion

Combined source `f0f7c4936e7fac75cb2c5693b02c02756aef85d9` merges
SC-07A head `036a29c4fd1bbb9e82753e170cabb85b87b05e3c`. Its diff from
`ad9283e8a7f1` changes tests and evidence, with no `src/` product change.
The new narrow-phone Environment publication-review assertion passes **1/1**
in an isolated production Chromium run on the combined source. The
[runtime receipt](f0f7c4936e7f-mobile-review/browser-runtime.json),
[suite profile](f0f7c4936e7f-mobile-review/browser-suite-profile.json),
[last-run marker](f0f7c4936e7f-mobile-review/playwright-last-run.json)
and [390 px review capture](f0f7c4936e7f-mobile-review/environment-review-mobile.png)
record the result. Generic capture and task-owned cleanup report `PASS`.
The 25/25 Library/Community suite and 2,000-Scene scale pass remain bound to
the identical product code at `ad9283e8a7f1`; they are not represented as
reruns on the later test-only merge. Protected Product Experience and owner
acceptance remain open.

## Shared compact and expanded publication status

Product source `f82d1b93d285736587a274b5a7076e1f41f0c40a` reads the same
owner-scoped Community listing for the selected saved item in compact and
expanded Library details. Both modes now identify a private creation and an
existing listing consistently. Closing the Harborlight publishing dialog
refreshes this selected-item status. The [focused production-browser receipt](f82d1b93d285-provenance/browser-runtime.json),
[last-run marker](f82d1b93d285-provenance/playwright-last-run.json) and
[Scene/Environment capture](f82d1b93d285-provenance/expanded-scene-actions.png)
cover the compact-to-expanded private Environment selection. The component
suite passes 20/20 cases, including published listing status in both modes.

The same exact product source passes a fresh **25/25** production Chromium
suite across compact/expanded browsing, physical placement, Scene and
Environment lifecycle, saved content, Community publication and installed
reuse. Its [runtime receipt](f82d1b93d285-full25/browser-runtime.json),
[suite profile](f82d1b93d285-full25/browser-suite-profile.json),
[last-run marker](f82d1b93d285-full25/playwright-last-run.json),
[desktop](f82d1b93d285-full25/expanded-desktop.png),
[narrow desktop](f82d1b93d285-full25/expanded-narrow.png),
[phone](f82d1b93d285-full25/expanded-phone.png),
[Scene actions](f82d1b93d285-full25/expanded-scene-actions.png) and
[placed selection](f82d1b93d285-full25/placed-selected.png) bind that pass
to the source. Generic capture and task-owned cleanup report `PASS`.

The separate exact-source 2,000-Scene production browser case passes **1/1**.
Its [measurement](f82d1b93d285-scale2000/browser-scale.json) records 48
first-page cards, 96 after Show more, one selected exact detail read after
opening, zero Scene gallery canvases, a 211 ms local expanded opening and a
956 ms local far-title search. The 390 px phone document fits its viewport.
The repeated authenticated full Studio bootstrap is 6,626,373 bytes and
reaches its heading in 4,987 ms locally. Its [runtime receipt](f82d1b93d285-scale2000/browser-runtime.json),
[suite profile](f82d1b93d285-scale2000/browser-suite-profile.json),
[last-run marker](f82d1b93d285-scale2000/playwright-last-run.json),
[desktop](f82d1b93d285-scale2000/2000-scenes-expanded-desktop.png) and
[phone](f82d1b93d285-scale2000/2000-scenes-expanded-phone.png) capture the
result. The bootstrap size and timings describe this local full-Studio run;
they do not qualify device or network performance.

Combined candidate `a2de36700323846bb55661b29dc0ed67c1cb4e0b` subsequently
merges SC-07A head `df5b7fcb8e8c8ea13fc569fa5a95d609fbeeacb0`.
That incoming diff adds an Environment ownership-revocation integration
assertion and engineering evidence, with no `src/` product change. The 25/25
and 2,000-Scene receipts remain bound to `f82d1b93d285`. Protected Product
Experience qualification, merge and owner acceptance remain open.

## Current Parallax + Harborlight + SC-00C combined candidate

Combined product source `7815431f871ee0650098d9b2c003a4d4c6aa6da0`
merges current Parallax branch `11776923abea3283e3b334f7b5b56954cb54fb49`
into the SC-00C/SC-07A candidate. The only merge conflict was in the
changelog; both records were retained. A fresh isolated production Chromium
run passes **25/25** Library, placement, Scene/Environment lifecycle and
Community journeys on that exact combined product. Its [runtime receipt](7815431f871e-full25/browser-runtime.json),
[suite profile](7815431f871e-full25/browser-suite-profile.json),
[last-run marker](7815431f871e-full25/playwright-last-run.json),
[desktop](7815431f871e-full25/expanded-desktop.png),
[narrow desktop](7815431f871e-full25/expanded-narrow.png),
[phone](7815431f871e-full25/expanded-phone.png),
[Scene actions](7815431f871e-full25/expanded-scene-actions.png) and
[placed selection](7815431f871e-full25/placed-selected.png) bind the result
to the merge. Generic capture and task-owned cleanup report `PASS`.

The first 2,000-Scene attempt on `7815431f871e` reached the Studio but
timed out looking for the historical-version button. Parallax had moved that
button into a collapsed **Library, reuse & publication** section in Guided
Scene settings. Its [failed runtime receipt](7815431f871e-scale2000-first-failure/browser-runtime.json),
[last-run marker](7815431f871e-scale2000-first-failure/playwright-last-run.json)
and [failure screenshot](7815431f871e-scale2000-first-failure/test-failed-1.png)
remain visible. Test-only source `e7d0e8a8314c2b75f15a85bc975316306775d179`
opens that section before selecting the same historical version; it changes
no product file. The corrected exact-source scale run passes **1/1** with
48/96 paged cards, one selected detail read, zero Scene gallery canvases and
a 390 px phone document within its viewport. The [measurement](e7d0e8a8314c-scale2000/browser-scale.json),
[runtime receipt](e7d0e8a8314c-scale2000/browser-runtime.json),
[suite profile](e7d0e8a8314c-scale2000/browser-suite-profile.json),
[last-run marker](e7d0e8a8314c-scale2000/playwright-last-run.json),
[desktop](e7d0e8a8314c-scale2000/2000-scenes-expanded-desktop.png) and
[phone](e7d0e8a8314c-scale2000/2000-scenes-expanded-phone.png) capture the
result. The authenticated whole-Studio bootstrap remains 6,626,373 bytes;
its 3,623 ms local heading time, 152 ms expanded opening and 946 ms far-title
search are observations from this local run, not device or network promises.

After the merge and test correction, the Studio, Lens and Library component
suites pass **58/58** checks. `docs:validate`, `features:sync` and
`features:validate` pass. Protected Product Experience qualification,
protected merge and owner acceptance remain open.

## Live owner publication status and recovery

The first expanded owner-status journey on test source
`94c3593dd784d220c40bf634db0ee631df92e6d5` stopped because the test
assumed the compact Library stayed open after publishing. Studio had closed
that dock, as shown by its [failed runtime receipt](94c3593dd784-status-first-failure/browser-runtime.json),
[last-run marker](94c3593dd784-status-first-failure/playwright-last-run.json),
[screen](94c3593dd784-status-first-failure/test-failed-1.png) and
[accessibility snapshot](94c3593dd784-status-first-failure/error-context.md).
The test now follows the Creator's return path by reopening Library.

Test-only source `057446ac9466bb7c140799de036b94095279f1e7` then passed
**1/1** isolated production Chromium journey. It checked a private owned
Asset before submission, **Community ready for review** after closing the
publisher and reopening compact Library, the same pending status in expanded
Library, and **Published in Community** in both sizes on a 390 px phone after
moderation approval and Studio reload. Its [runtime receipt](057446ac9466-owner-status/browser-runtime.json),
[suite profile](057446ac9466-owner-status/browser-suite-profile.json),
[last-run marker](057446ac9466-owner-status/playwright-last-run.json) and
[dark phone capture](057446ac9466-owner-status/owner-published-phone.png)
bind the result to that test source. Generic capture and owned cleanup pass.

The current root handoff `fbd1c5b693c8409702bcf1f1c534a95f308725d0`
adds Parallax review/test/evidence records while preserving this candidate's
`src/` product tree. Test-only continuation
`d8acfb958cfa0d500e18b027896159c0752a259d` passed the same full
owner publication journey **1/1** and additionally exercised a one-time
publication-status `503`, visible **Retry status**, and the approved item in
light theme on the 390 px phone. The [runtime receipt](d8acfb958cfa-owner-status/browser-runtime.json),
[suite profile](d8acfb958cfa-owner-status/browser-suite-profile.json),
[last-run marker](d8acfb958cfa-owner-status/playwright-last-run.json),
[pending compact detail](d8acfb958cfa-owner-status/owner-pending-compact.png),
[dark phone detail](d8acfb958cfa-owner-status/owner-published-phone.png) and
[light phone detail](d8acfb958cfa-owner-status/owner-published-phone-light.png)
show those states. Generic capture and task-owned cleanup report `PASS`.
This is local synthetic software proof; protected qualification and owner
acceptance remain open.
