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
fully audited combined code/contract candidate is `56ffcc596`
on [draft PR #736](https://github.com/Kgray44/treasurehuntSoT/pull/736). Its
[source-bound evidence](evidence/sc-00c/20261015-pr736-final/README.md)
contains a passing production build, 25 combined browser cases, five separate
SC-07A Community browser cases, and a 2,000-Scene browser scale case. Earlier
failed and passing receipts remain under the linked historical evidence folders.
PR #736 has since advanced to `b44a27afe` with focused SC-07A keyboard
evidence and the separate SC-00C Collection continuation recorded below; a
new full combined qualification is still required.

| Required journey                                       | Latest evidence on the integrated draft candidate                                                                                                                                                                                                                                                                                                                                                      | Open boundary                                                                                       |
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

**Current result: not accepted.** The canonical Product Experience planner
fails on the separately owned
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`
contract. The current `testing/contracts.json` browser list now registers the
SC-00C direct and SC-07A five-case suites, but its trusted capture journeys
still lack the Creator-to-moderator-to-installer visible chain. A pre-refit
trusted Library journey also names a removed button, which requires a
governance-compatible resolution. The draft evidence cannot replace protected capture/review,
Sounding Line qualification, or owner product acceptance. The [aggregate
coexistence evidence](evidence/sc-00c/20261015-aggregate-coexistence/README.md)
includes the separately reviewed phone correction, but PR #722 and PR #736
remain independent draft/review scopes.
