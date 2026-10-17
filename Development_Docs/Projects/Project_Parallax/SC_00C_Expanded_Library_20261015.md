---
title: SC-00C expanded Spatial Library implementation checkpoint
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-expanded-spatial-library-20261015
last_reviewed: 2026-10-17
---

# Expanded Spatial Library

The compact left Library and expanded floating workspace render one mounted
`SpatialContentLibrary`. Search, category, source, collection, sort, selected
item, page cursor and exact detail reads remain in that component while the
presentation changes. Both modes call the same Scene, Environment, insertion
and Harborlight actions. Opening the workspace does not reinstall a Scene or
remount the viewport, so the camera, selected object, unsaved edits and Undo
history remain in Spatial Studio.

The expanded workspace has a content navigation column, paged thumbnail
gallery and contextual detail panel. A selected SC-02 physical model alone may
open a small interactive 3D inspector. It builds one procedural model without
full texture allocation, caps renderer pixel ratio and canvas dimensions,
renders only on resize or user rotation, and releases GPU resources when the
selection or presentation changes. Other content retains its canonical
thumbnail or semantic preview; no 3D bytes are loaded for every card.
Source, Show and Sort sit in a compact toolbar above the gallery instead of
occupying the left navigation column. On phones, Filters opens those controls
when needed, so content is visible immediately below search and category
navigation. Category tabs use arrow, Home and End keys and retain a visible
focus target.

**Place in Scene** for a physical asset closes the overlay and enters the
existing renderer's surface picker. The pointer highlights a safe compatible
support; keyboard users can choose an explicit safe room surface. An invalid
point inserts nothing and leaves placement active; Cancel inserts nothing.
Successful insertion uses the existing checked `insertSpatialElementInEnvironment`
edit, selection and Undo/Redo path. Classic authored presets retain their
separately labelled Add action.

Saved Assets now use the same viewport surface picker from either Library
presentation. The selected immutable release and existing `ASSET_INSERT`
service still check ownership, installed-license permissions and source
lineage. The checked copy is fitted to the chosen safe surface before ordinary
history and persistence install it; a blocked point or cancellation adds
nothing. The floor choice offered to keyboard users finds a clear point on
that named floor. Compositions retain their separate reuse action.

Scenes and Environments remain definitions, not draggable physical objects.
Open and edit use the existing SC-01 callbacks. The expanded Create Scene from
Environment and Duplicate Scene actions open the canonical Scene Manager with
the selected source preselected. Exact release selection and duplication remain
Scene Manager operations. Harborlight's existing publishing dialog remains the
mutation path; selected owned items read their publication status from its
owner-scoped listing endpoint. Built-in, owned, installed and published statuses
are named separately. Installed releases remain read-only with license and
credit details.

## Validation boundary

The reviewed Library implementation `99738a6efb56e6c794bd91e841ca68542320e664`
passed two task-isolated production Chromium journeys: compact to expanded to
checked placement and back, then narrow/phone, light theme, reduced motion and
catalog error recovery. A separate combined run passed 18 Library, insertion,
Scene/Environment lifecycle and Harborlight Community cases on the same source.
Both runs used synthetic accounts and fresh task-owned SQLite databases. The
[source-bound captures and independent screenshot review](evidence/sc-00c/20261015-expanded-library/README.md)
show the compact toolbar and responsive states. An earlier candidate passed its
functional journeys but exposed a narrow-layout gap and footer collision; the
final capture repairs both. The independent re-review found no remaining
concrete blocker in the captured states. A separate fresh 2,000-Scene browser
case passed on that source, with a 48-card first page and 96 cards after
Show more; its 6.6 MB full Studio bootstrap remains a scale limit. This is
bounded local product evidence.

The branch then merged the latest SC-07A Harborlight draft into local candidate
`55a3dcccf380823d7abf8462467e3c4eda09a376`. The Library presentation
source did not change. The exact merged candidate passed 21/21 production
Chromium journeys, including compact-to-expanded placement, responsive layouts,
Scene/Environment lifecycle and Harborlight Profile recovery. Product
Experience planning on that candidate stops at the separately owned Crossdeck
continuity design requirement; the [merged-source record](evidence/sc-00c/20261015-expanded-library/README.md)
retains the captures and blocker.

The latest local merge `73fe12a1b159c1846a8d91a926c0af0d39297568`
also includes SC-07A's version-pinned Environment return after Profile setup.
Its combined production Chromium suite passes 22/22 cases, with fresh expanded
Library captures. The same Crossdeck experience-design gate blocks the exact
candidate's protected plan.

The later local source `3557eddd689fe13325eeff32240cb41fcefbb5bf`
adds direct expanded Environment/Scene and installed Community journeys and a
thin details scrollbar for long contextual action lists. Four selected
production Chromium cases pass on that exact source, including the compact to
expanded placement return, responsive/error states, SC-01 Create Scene and
Duplicate Scene with independent Environment pins, and read-only installed
provenance in both presentations. The [source-bound evidence](evidence/sc-00c/20261015-expanded-library/README.md)
preserves the pass receipts, desktop/phone captures and the earlier
test-expectation failure. The 22-case combined run above is bound to its
earlier source; no new full combined suite is claimed for this continuation.

After that focused run, the owned candidate merged current main
`670706e875eeac61031f08f69595db2dc9a81879` and current SC-07A draft
`0395e6d83a71f8a48818b3b0ff0ecf3167347143` into
`09bd7c9e1fe2b839f734b0d7be28deceb64605d4`. The merged source passed
14/14 expanded Library and Community cases and a separate 25/25 compact,
expanded, placement, lifecycle and publication suite on fresh isolated
production-browser databases. Its exact Product Experience plan still requires
the separately owned Crossdeck Phase 2 continuity design. The
[integration receipts](evidence/sc-00c/20261015-expanded-library/README.md)
and captures bind these results to that source.

The later `a02821a668b7` test-only continuation passed a fresh
2,000-Scene production-browser case for the expanded workspace. It retained
96 paged cards on opening, loaded one exact selected detail, rendered no
Scene-card canvases, searched a far title in 938 ms locally, and fit the
390 px phone viewport. The 6.6 MB Studio bootstrap remains a separate
whole-Studio scale limit. The [scale report and captures](evidence/sc-00c/20261015-expanded-library/README.md)
are bound to that test source; they do not replace protected device or owner
acceptance.

The later SC-07A motion and reuse-rights draft `9ff620ce9589` was merged
into local source `e601b1e07d64`. Its fresh isolated production Chromium run
passes 14/14 expanded Library and Community cases. The Library presentation
source is unchanged; the [new exact-source receipt](evidence/sc-00c/20261015-expanded-library/README.md)
checks its publishing and installed-content coexistence. The 25-case
coexistence and scale observations above remain bound to their earlier sources.

The later test-only `d53f7387c4aa` source passes 3/3 expanded Library
production Chromium journeys. The compact-to-expanded placement case now
checks the actual projected camera through the Library round trip and retains
an unsaved selected-object edit after closing and reopening. The saved draft
remains unchanged until a save action. The [exact-source receipt and retained
test setup failures](evidence/sc-00c/20261015-expanded-library/README.md)
separate this focused proof from the earlier 14-case and 25-case suites.

The newer SC-07A reviewed-package presentation is combined at
`9420c76d44a8`. A fresh isolated production Chromium run passes 14/14
expanded Library and Community journeys, including the camera and unsaved-edit
return. Its [receipt and captures](evidence/sc-00c/20261015-expanded-library/README.md)
are bound to that merge; protected qualification remains separate.

An additional fresh-database run on candidate `db684d89a207` passes 25/25
compact and expanded Library, placement, lifecycle and Community browser
journeys. The [current-source receipt and captures](evidence/sc-00c/20261015-expanded-library/README.md)
close the prior gap between the latest combined source and the broader journey
suite. Protected experience qualification and owner acceptance remain open.

The latest combined `fe5064bc1782` source merges current protected main and
SC-07A's license-governed installed reuse. Its fresh 25/25 production Chromium
journey run passes with the compact top Source, Show and Sort toolbar intact.
The [receipt and captures](evidence/sc-00c/20261015-expanded-library/README.md)
are local evidence; protected Product Experience and owner acceptance remain
open.

The same merged source also passes a fresh 2,000-Scene browser scale journey
with paged 48/96-card browsing, one selected detail read, zero gallery canvases
and no 390 px phone overflow. The [measurement and captures](evidence/sc-00c/20261015-expanded-library/README.md)
retain the 6.6 MB full Studio bootstrap as a whole-Studio performance limit.

The final local toolbar refinement at `780b8a76dc3c` also puts the Scene
Environment filter on that short top row. The exact-source 2,000-Scene
production browser journey asserts the row alignment and passes; a separate
25/25 production Chromium suite covers the full compact/expanded and
Harborlight coexistence journeys. See the [captures and receipts](evidence/sc-00c/20261015-expanded-library/README.md).

The later `22a7340a5755` merge includes Harborlight's verified saved-Asset
reuse. A fresh 25/25 production Chromium suite passes on that exact combined
source, including the read-only installed origin and credited private copy.
The [new receipt](evidence/sc-00c/20261015-expanded-library/README.md)
does not rebind the earlier 2,000-Scene measurement to this merge.

The latest `ad9283e8a7f1` source includes SC-07A's Creator-facing package
review labels and a settled-width check for the animated phone overlay. A
fresh 2,000-Scene scale run passes **1/1** and the separate combined browser
suite passes **25/25**. The [source-bound report](evidence/sc-00c/20261015-expanded-library/README.md)
retains the first transient measurement failure and its correction.

The subsequent `f0f7c4936e7f` stack update adds only SC-07A's narrow-phone
Environment review assertion and evidence; no `src/` product file changes
from `ad9283e8a7f1`. Its focused isolated production browser case passes
**1/1**. The [receipt](evidence/sc-00c/20261015-expanded-library/README.md)
keeps the earlier full and scale runs bound to their exact source.

The current SC-00C product source `f82d1b93d285` closes a compact-view
provenance gap: selected owned content now shows the same owner-scoped private
or Community-listed status in both Library sizes. The publishing dialog
refreshes that status when closed. A fresh [25/25 combined production-browser
run and separate 2,000-Scene scale case](evidence/sc-00c/20261015-expanded-library/README.md)
pass on that exact source. The scale case keeps 48/96 paged cards, one selected
detail read, zero Scene gallery canvases and a 390 px phone document within
the viewport. The 6.6 MB whole-Studio bootstrap remains a measured local
performance limit.

Current combined head `a2de36700323846bb55661b29dc0ed67c1cb4e0b`
also carries SC-07A's later Environment ownership-revocation integration
test and evidence without another product-source change. Protected Product
Experience qualification, merge and owner acceptance remain open.

The Parallax root branch at `11776923abea` is now merged into SC-00C product
source `7815431f871e`. A fresh **25/25** combined production Chromium suite
passes. The first scale attempt exposed an outdated test expectation for the
new collapsed Scene settings section; its failed receipt remains retained.
Test-only source `e7d0e8a8314c` opens that section and passes the 2,000-Scene
journey **1/1** on unchanged merged product code. The [current combined
receipts](evidence/sc-00c/20261015-expanded-library/README.md) and 58/58
Studio, Lens and Library component checks support this draft handoff. The
whole-Studio bootstrap remains 6.6 MB locally. Protected qualification and
owner acceptance remain open.

A later live owner browser journey confirms private, pending-review and
published status across compact and expanded Library details. On test-only
`d8acfb958cfa`, a publication-status `503` exposes **Retry status**; the
approved saved item remains legible on a 390 px phone in dark and light
themes. The [passing capture and retained first test failure](evidence/sc-00c/20261015-expanded-library/README.md)
are bound to their exact sources. Current Parallax root handoff
`fbd1c5b693c8` keeps the same `src/` product tree. Protected qualification
and owner acceptance remain open.

Saved-asset placement product source `0d063b281ee1` has focused geometry and
type checks. Test-only continuation `5acf6fa60826` passes a fresh **2/2**
production Chromium run: a private Asset moves from compact to expanded
Library, cancels and retries placement, checks invalid-point feedback,
retains its pinned version, selection and Undo/Redo, then reopens the same
Library context; a separately installed Asset keeps its licensed credited-copy
path. The [source-bound recordings, screenshots and runner receipts](evidence/sc-00c/20261015-expanded-library/README.md)
also retain the preceding failed product and test-locator attempts. The
corrected trusted journey uses the current Library controls rather than the
removed Saved panel. This local proof does not establish protected Product
Experience or owner acceptance.

Protected Product Experience planning still requires the separately owned
Crossdeck Phase 2 design contract. The Parallax integration candidate and
SC-07A publication candidate have been combined locally for this checkpoint.
No protected merge, owner acceptance, live photo accuracy or physical AR
qualification is claimed here.

Independent source review of final local candidate `5167e718a8f1` retained
two saved-placement blockers: physical rendered scale or unchecked parts
could differ from planner geometry, and root animation keys could remain in
the old anchor frame. Bounded product source `c5b977c81` preserves the
resolved size for a single physical root, rejects multi-part physical
definitions before mutation, and rebases root animation for physical and
schematic surface placement. Focused tests pass **78/78** across five suites.
The [evidence record](evidence/sc-00c/20261015-expanded-library/README.md)
keeps prior browser receipts bound to their own sources. At this checkpoint,
the repair awaited independent rereview and fresh browser qualification.
Source `9491faf6a` also removes a raw-width keyboard presearch for physical
saved models so the full rendered-size planner handles that route. A focused
small-table test checks keyboard and pointer parity; five suites pass **79/79**.
Independent rereview and fresh browser proof follow in the next checkpoint.
The narrow independent source rereview resolves the two helper defects and
the keyboard caller issue within its reviewed scope. Final test source
`7ac7594e665e` adds rendered timeline verification on unchanged placement
product code and passes **3/3** fresh isolated production Chromium placement
and reuse journeys. The first scaled browser fixture failed due to an
unrelated Scene object occupying the table; its receipt is preserved beside
the corrected pass. [Source-bound evidence](evidence/sc-00c/20261015-expanded-library/README.md)
keeps protected Product Experience and owner acceptance open.

## Library card actions and phone viewport return

Later isolated source `f7b0737acc2d` adds card context actions through the
existing Studio menu and canonical Library callbacks. Right-click and
Shift+F10 expose preview and the applicable Asset insertion or Scene Archive
action; the active working Scene's Archive stays disabled. A queued Library
scroll notification no longer closes a newly opened menu, while actual later
scrolling still dismisses it. On narrow screens, choosing **Place in Scene**
closes the compact Library and reveals the placement preview in the viewport.
The [focused source-bound record](evidence/sc-00c/20261017-library-context-menu-f7b0737a/README.md)
passes one production Chromium journey covering these interactions, including
Undo, keyboard focus, light theme and reduced motion. Root combined replay,
protected qualification and owner acceptance remain separate.
