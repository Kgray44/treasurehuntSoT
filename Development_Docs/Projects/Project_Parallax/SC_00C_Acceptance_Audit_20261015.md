---
title: SC-00C Spatial Library acceptance audit
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-spatial-library-acceptance-audit
last_reviewed: 2026-10-15
---

# Spatial Library acceptance audit

This audit maps the 12 requested journeys to rendered evidence and separates
local software proof from protected qualification and owner acceptance. The
initial combined code/contract audit used `56ffcc596`
on [draft PR #736](https://github.com/Kgray44/treasurehuntSoT/pull/736). Its
[source-bound evidence](evidence/sc-00c/20261015-pr736-final/README.md)
contains a passing production build, 25 combined browser cases, five separate
SC-07A Community browser cases, and a 2,000-Scene browser scale case. Earlier
failed and passing receipts remain under the linked historical evidence folders.
An earlier local SC-00C, Parallax and Harborlight candidate, recorded in the
[SC-00C draft PR #739](https://github.com/Kgray44/treasurehuntSoT/pull/739)
history, has exact product source `7815431f871e`. It passes a fresh **25/25**
production Chromium suite; the
test-only scale continuation passes **1/1** with 2,000 Scenes, and the later
live owner-status continuation passes **1/1** from private to approved
publication in compact and expanded Library views, including 390 px dark/light
phone states and publication-status retry. The [historical receipts](evidence/sc-00c/20261015-expanded-library/README.md)
retain failed attempts alongside their corrected passes. These are local
candidate results, not protected qualification or owner acceptance.

The later saved-Asset insertion correction passes a separate **2/2**
production Chromium run on test source `5acf6fa60826`: private Asset
placement from compact and expanded Library, invalid-point feedback,
cancellation, pinned copy and Undo/Redo; plus a licensed installed Asset's
credited copy. [Its recordings and receipts](evidence/sc-00c/20261015-expanded-library/README.md)
retain the first blocked-floor product failure and the corrected result.
The preceding 25-case and scale results remain bound to their earlier source.

| Required journey                                       | Historical audited source-bound evidence                                                                                                                                                                                                                                                                                                                                                                  | Open boundary                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1. Search for a built-in asset                         | The direct Library test finds Peeking Letter by search; its preview is [captured](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/built-in-asset-preview.png).                                                                                                                                                                                                                           | Owner experience review.                                                                            |
| 2. Preview and insert it                               | The same test inspects and adds the built-in asset; the SC-02 suite also places typed elements and a reusable composition.                                                                                                                                                                                                                                                                             | Owner experience review.                                                                            |
| 3. Find the new asset in the Scene                     | Immediate Inspector and Scene Graph selection are asserted and [captured](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/built-in-asset-selected.png); physical drag also selects its new instance.                                                                                                                                                                                     | Owner experience review.                                                                            |
| 4. Browse a saved Environment                          | The direct journey opens its exact owned card and [preview](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/saved-environment-preview.png); the Environment suite edits, applies and archives while preserving Scene snapshots.                                                                                                                                                          | Live photo accuracy and physical AR remain separate.                                                |
| 5. Inspect associated Scenes                           | The direct journey follows the Environment filter to two independent [pinned Scenes](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/associated-scenes.png).                                                                                                                                                                                                                             | Installed Scene relationships require protected replay.                                             |
| 6. Open one Scene and return                           | The direct journey opens Scene Beta, changes editor hierarchy, returns to the same Library category and Environment filter.                                                                                                                                                                                                                                                                            | Owner experience review.                                                                            |
| 7. Reuse a saved asset or prefab                       | The SC-02 combined test saves and independently reuses a composition, retains Undo/reload and exercises rendered playback; prior [focused repair evidence](evidence/sc-00c/20261015-composition-rerun/README.md) covers the stale Source-filter defect.                                                                                                                                                | Owner experience review.                                                                            |
| 8. Rename or duplicate owned content                   | The direct journey renames Scene Beta and retains both Environment pins in the [rendered card](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/scene-renamed-with-environment-pin.png); Scene Manager duplicates and renames independently.                                                                                                                                              | Protected owner-boundary replay.                                                                    |
| 9. Distinguish private and published Community content | The five-case SC-07A suite checks private source, moderated approval, immutable installed return, Environment publication and refusal/retry. [SC-07A captures](evidence/sc-07a/20261015-readonly-return/README.md) show the visible chain and provenance.                                                                                                                                              | The canonical experience registry lacks a trusted Creator-to-moderator-to-installer replay mapping. |
| 10. Browse a growing catalog                           | The [2,000-Scene report](evidence/sc-00c/20261015-pr736-final/browser-scale.json) records 48-card pages, 96 after Show more, 945 ms far search and 26,345-byte first page.                                                                                                                                                                                                                             | The full Studio bootstrap remains 23,990,373 bytes; network/device performance is unqualified.      |
| 11. Keyboard and responsive layouts                    | At 390 px, keyboard card actions insert and select the asset; the 2,000-Scene case inspects details by keyboard, resizes to 210/420 px and has no phone overflow. [Phone capture](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa-scale/2000-scenes-phone.png).                                                                                                                          | Accessibility and interaction review through protected Product Experience replay.                   |
| 12. Preserve saved content after migration             | The exact-candidate lifecycle cases retain private save membership, immutable version history, working/legacy discovery, stable CAS retry and historical-copy intent; Scene Manager and Environment tests retain independent pins, reconstruction and autosave retry. The earlier [12-case source-bound suite](evidence/sc-00c/20261015-combined12-pass/README.md) also checked legacy release/reload. | Protected replay and owner review.                                                                  |

After the audited combined candidate, source `2ecf9790f6eb` added an
explicit named Collection filter to the paged catalog. Its
[separate source-bound evidence](evidence/sc-00c/20261015-collection-filter/README.md)
records three direct Library passes and a fresh 2,000-Scene browser pass. The
first page held 48 cards in 26,371 bytes and Show more rendered 96; the far
search took 2,005 ms on that local run. The full Studio bootstrap remained
23,990,373 bytes and heading readiness varied to 11,006 ms. Its evidence commit
is now on draft PR #736; protected main remains unchanged. The bootstrap cost remains open
with SC-01's Scene Manager owner. The brief has no numeric performance budget;
these local timings do not prove network or device responsiveness.

The integrated UI also shows one Studio navigation rail, five provider-aware
content categories, source-grounded preview metadata, contextual actions,
favorites and collections. The [organization screenshot](evidence/sc-00c/20261015-pr736-final/screenshots/56ffcc596daa/favorite-collection-filter.png)
and direct test verify a favorite Scene under its named collection with the
nonfavorite sibling excluded. Environment creation retains existing, empty and
photo entry paths; local browser proof does not establish real reconstruction
quality. Community actions consume SC-07A's governed service and release
semantics. The 25-case [consumer and lifecycle log](evidence/sc-00c/20261015-pr736-final/core25-browser.log.txt)
and [Community log](evidence/sc-00c/20261015-pr736-final/sc07a-browser.log.txt)
bind these statements to the candidate.

**Current result: not accepted.** The earlier canonical Product Experience planner
failed on the separately owned
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`
contract. At that audited snapshot, `testing/contracts.json` registered the
SC-00C direct and SC-07A five-case suites, while trusted capture still lacked
the Creator-to-moderator-to-installer visible chain and a pre-refit Library
journey named a removed button. That trusted saved-Asset journey now names the
current expanded Library, selected Asset details, explicit placement preview
and floor choice. The draft evidence cannot replace protected capture/review,
Sounding Line qualification, or owner product acceptance. The [aggregate
coexistence evidence](evidence/sc-00c/20261015-aggregate-coexistence/README.md)
includes the separately reviewed phone correction, but PR #722 and PR #736
remain independent draft/review scopes.

Authority PR #740 has since landed as a control-plane change. The separately
owned Crossdeck #721 repair/capture window now governs when Parallax may use
protected qualification. The active Parallax root
[handoff](Root_Coexistence_20261015.md) still records an unresolved full-plan
`spawnSync git ENOBUFS` and holds competing protected actions. SC-00C's
current local pass therefore remains unaccepted; no new protected acceptance
is inferred from #740 or the generic browser receipts.

## Expanded presentation addendum

The later local combined source `3557eddd689fe13325eeff32240cb41fcefbb5bf`
retains the compact Library and adds the expanded floating presentation over
the same mounted catalog and selection state. [Four focused production Chromium
journeys](evidence/sc-00c/20261015-expanded-library/README.md) pass on that
exact source. They verify a built-in physical asset's selected 3D preview,
checked surface-placement return, surviving canvas mount/selection/Undo,
responsive and reduced-motion layouts, catalog-error recovery, owned
Environment-to-Scene browsing and canonical Scene Manager creation/duplication,
and a licensed installed release's read-only permissions in both views. The
Source, Show and Sort controls appear together above the desktop gallery. Long
Scene details expose their actions by scrolling. The 22-case combined run is
bound to the preceding `73fe12a1b159` source; this four-case run adds focused
evidence, not a new full combined qualification. The protected Crossdeck
design gate and owner acceptance remain open.

The subsequent current-head merge `09bd7c9e1fe2` includes protected main
`670706e875` and SC-07A draft `0395e6d83`. Its separate fresh-database
production Chromium runs pass 14/14 expanded/Community cases and 25/25
combined Library, placement, saved lifecycle and Community cases. The
[current-head receipts](evidence/sc-00c/20261015-expanded-library/README.md)
retain exact-source identity and cleanup status. The Product Experience plan
on that same source still names the Crossdeck Phase 2 continuity design gate;
this audit remains unaccepted.

An additional [expanded 2,000-Scene browser run](evidence/sc-00c/20261015-expanded-library/README.md)
passes on test source `a02821a668b7`: 48 cards on the first page, 96 after
Show more, one exact selected detail, zero gallery canvases, a local 938 ms
far search and no 390 px phone document overflow. Its 6.6 MB Studio
bootstrap and local timing remain performance limits, not a network/device
acceptance claim. The first test attempt and corrected pass are both retained.

SC-07A motion and reuse-rights source `9ff620ce9589` is now combined with
SC-00C at `e601b1e07d64`. A fresh 14/14 expanded Library and Community
browser run passes on that exact source; the
[receipt](evidence/sc-00c/20261015-expanded-library/README.md) is separate
from the earlier 25-case coexistence and 2,000-Scene scale evidence.

Focused test source `d53f7387c4aa` passes 3/3 expanded Library production
Chromium journeys. The placement round trip now checks projected camera
preservation and an unsaved selected-object edit alongside the existing
mounted viewport, selection and Undo assertions. The stored Scene draft stays
unchanged. Its [receipt](evidence/sc-00c/20261015-expanded-library/README.md)
and two retained test setup failures are source-bound; protected experience
review and owner acceptance remain open.

Combined source `9420c76d44a8` includes SC-07A's reviewed package list and
passes a fresh 14/14 expanded Library and Community production Chromium suite.
The [source-bound receipt](evidence/sc-00c/20261015-expanded-library/README.md)
keeps this pass distinct from earlier 25-case and 2,000-Scene runs. Protected
qualification and owner acceptance remain open.

The latest combined candidate `db684d89a207` passes a fresh **25/25**
production Chromium suite across the compact and expanded Library,
Environment/Scene lifecycle, physical placement, keyboard/theme layouts,
and Community publication. Its [receipts and screenshots](evidence/sc-00c/20261015-expanded-library/README.md)
cover the original twelve journeys on the current combined product source;
the separate 2,000-Scene scale observations remain bound to `a02821a668b7`.
Generic capture and cleanup passed. Protected Product Experience replay and
owner acceptance remain open.

Current combined source `fe5064bc1782` includes protected main `aaef39a57`
and SC-07A's license-governed installed Composition reuse. A fresh **25/25**
isolated production Chromium suite passes across compact and expanded Library,
placement, saved lifecycle and Community journeys. The [source-bound receipt](evidence/sc-00c/20261015-expanded-library/README.md)
keeps this result distinct from earlier candidates and protected acceptance.

The same `fe5064bc1782` source passes a separate 2,000-Scene production
Chromium scale journey. The [current-source report](evidence/sc-00c/20261015-expanded-library/README.md)
shows bounded 48/96-card paging, one selected detail read, zero Scene gallery
canvases and no 390 px phone overflow. Its 6.6 MB full Studio bootstrap and
local timing remain explicit performance limits, not device acceptance.

On `780b8a76dc3c`, the expanded Scene filter moves into the same compact top
row as Source, Show and Sort. A fresh 2,000-Scene production Chromium test
asserts the alignment, and a separate 25/25 combined suite passes. The
[source-bound captures and receipts](evidence/sc-00c/20261015-expanded-library/README.md)
include desktop, narrow desktop and phone presentations. Protected experience
qualification and owner acceptance remain open.

The SC-07A saved-Asset reuse merge at `22a7340a5755` passes 25/25 fresh
production Chromium journeys on its [combined-source receipt](evidence/sc-00c/20261015-expanded-library/README.md),
including credited installed Asset reuse and the expanded Library journeys.
The separate 2,000-Scene run remains source-bound to `780b8a76dc3c`.

The latest `ad9283e8a7f1` combined source passes a separate 2,000-Scene
production browser run and 25/25 full Library, placement, lifecycle and
Harborlight journeys. Its [receipts and captures](evidence/sc-00c/20261015-expanded-library/README.md)
also preserve the prior in-transition phone-width test failure and its
settled-layout correction. Protected Product Experience and owner acceptance
remain open.

The later `f82d1b93d285` product source explicitly shows owner-scoped
publication status for selected saved content in both Library presentations.
A compact private Environment selection followed by expansion and a
published-listing selection in each mode have focused coverage. The same
source passes a fresh **25/25** combined production Chromium suite and a
separate **1/1** 2,000-Scene scale case. Its [receipts and captures](evidence/sc-00c/20261015-expanded-library/README.md)
bind the proof to that source. Combined head `a2de36700323846bb55661b29dc0ed67c1cb4e0b`
adds SC-07A's test/evidence-only ownership-revocation check. Protected
Product Experience qualification and owner acceptance remain open.

The latest combined Parallax/Harborlight/SC-00C product source `7815431f871e`
passes **25/25** production Chromium journeys. Test-only continuation
`e7d0e8a8314c` passes the separate 2,000-Scene scale case **1/1** after
opening the newly collapsed Scene reuse section before selecting a historical
version. The [first failed attempt and passing receipts](evidence/sc-00c/20261015-expanded-library/README.md)
remain source-bound. These local runs do not confer protected Product
Experience or owner acceptance.

Journey 9 now also has a live owner flow on test-only `d8acfb958cfa`:
private saved Asset, submitted pending review, approved published listing,
compact and expanded status, 390 px dark/light phone presentation, and a
transient publication-status error with successful Retry. It passes **1/1**
on the unchanged merged product tree. The [first test return-path failure
and corrected captures](evidence/sc-00c/20261015-expanded-library/README.md)
remain separate. Protected and owner acceptance remain pending.

The final SC-07A exact-head merge source `1fc560ac2990` includes the public
package privacy correction and its source-bound SC-07A evidence. A separate
fresh-database production Chromium run passes **2/2** private and installed
Asset placement journeys on this exact merge source. The [runtime, suite
profile, recordings and captures](evidence/sc-00c/20261015-expanded-library/README.md)
retain that narrower result. Typecheck, focused unit tests, Product Experience
contract tests, documentation and Feature Catalog validation pass. The earlier
25-case and 2,000-Scene receipts remain source-bound to their respective
candidate commits; protected qualification and owner acceptance remain open.

Independent review of `1fc560ac2990` then found a late-cancellation race,
planar-only acceptance of saved physical models, and detached parented
schematic children. Repair source `943907017` guards the live attempt across
the initial save and insertion response, uses full solid clearance on the
selected support, and retains child-local animation frames. Multi-solid
assemblies fail visibly pending reviewed placement. Focused tests pass
**59/59** and a fresh production Chromium run passes **2/2**, including a
delayed canceled response followed by successful placement. The [repair
recording and runtime receipt](evidence/sc-00c/20261015-expanded-library/README.md)
retain exact-source local proof. Protected qualification and owner acceptance
remain open.

Final combined local source `8840a4bc2c09` includes SC-07A test/evidence
head `a22e265f78a0`. Fresh task-owned production Chromium runs pass
**15/15** Library/Community and **11/11** lifecycle/drag journeys on two
separate databases. A third fresh database passes the 2,000-Scene browsing
case **1/1**, including compact top filters, desktop/narrow/phone layouts,
48/96-card paging and bounded selected-detail reads. The [exact-source
receipts, metrics and captures](evidence/sc-00c/20261015-expanded-library/README.md)
retain the split runs and their cleanup status. The 6.6 MB whole-Studio
bootstrap remains a measured performance limit. Protected Product Experience,
physical-device and owner acceptance remain open.

## Current dependent draft reconciliation

An earlier draft PR #739 had merge source `9a4eebe5145e1734526fa5d7e4f73e53a888e7fd`,
which combines the prior SC-00C head `e4b953b8775fbb672d320af1fdb1dbccd4a418c7`
with SC-07A draft `4680e62cd88af716acfc6ce2a0bd139db3735da7`.
The three textual conflicts in `.gitattributes`, the changelog and current
product status were resolved while retaining both branches' evidence and
source. The Library, Studio, catalog, placement, publishing and focused
browser-spec files checked in this merge are byte-identical to the local
three-way rehearsal `8f1e87ac25602b9bf2291e73c0174eddc11509ad`.
Its [source-bound SC-07A record](evidence/sc-07a/20261015-combined-r6/README.md)
reports **16/16** expanded Library and publishing journeys, a separate
**1/1** 2,000-Scene case, and **4/4** compact Library and drag cases. Those
runs prove the rehearsal source, not the whole PR #739 tree.

On that earlier reconciled PR source, TypeScript, targeted lint, documentation and
Feature Catalog checks pass. A local standard production build has no passing
receipt: the first setup used a dependency junction rejected by Turbopack;
after installing local dependencies, Windows reported resource error 1450
while Turbopack read an unrelated archived video. Neither failure is counted
as a product validation pass. Crossdeck PR #721's protected run
`38822426167` failed in custody reservation with `fetch failed` before
product verification; protected main remained unchanged. The Crossdeck owner
is preparing the authorized guarded retry. Protected SC-00C qualification,
physical-device proof and owner acceptance remain open.

## Current SC-07A and Parallax root rehearsal

Draft PR #739 now has head `a4fd2da9fabbd6c1d9dec7d836ed451ccf843abc`
and is mergeable against SC-07A PR #736 head
`9c6de12a34f7391607eb26df37752dcdc82c60ed`. Its Source, Show, Sort and
contextual controls remain together in a slim row above the expanded desktop
gallery. Documentation, Feature Catalog, TypeScript and all 20 focused Library
component checks pass on that PR head. The newer SC-07A source label and its
own 11/11 browser receipt remain attributed to SC-07A.

Unpushed local rehearsal `d2b59c98cbd2eaa06541d2687a090e8a03533255`
merges that PR head with Parallax root PR #722 head
`325a0c5d2f37ee975d16527960048815ee8edcf9`. On the exact committed
rehearsal, a fresh production Chromium suite passes **27/27** Library,
placement, lifecycle and Community journeys; a separate fresh database passes
the **1/1** 2,000-Scene browsing case. Both runtime receipts report capture
and owned cleanup `PASS`. The [source-bound evidence](evidence/sc-00c/20261016-root-rehearsal-d2b59c98/README.md)
contains original logs, receipts, metrics, SHA-256 manifest and inspected
desktop, narrow, phone, light/reduced-motion, placement and scale captures.
The 6,626,373-byte repeated whole-Studio bootstrap is still a measured cost.
These local results do not qualify the draft branches or protected main.
Crossdeck's guarded protected retry, Product Experience review, physical-device
proof and owner acceptance remain open.
