---
title: Four-path Studio correction and current-source local verification
audience: product-engineering
status: partial-qualification
canonical_for: parallax-four-path-correction-20261017
last_reviewed: 2026-10-17
---

# Four-path corrective result

Source **`3dedbb9cd10e548d10d58bddef6d48c1823f54e5`** passes all four focused
construction/direct-placement/exclusion/parametric-room cases, then all eleven
combined cases, with zero failures or skipped/not-run cases. These overlapping
runs are not added together as distinct coverage. Production builds and full
TypeScript pass; each isolated runtime records unchanged source, a clean tested
tree and successful owned cleanup. This closes the four named local correction
paths; it does not qualify the complete Studio, protected integration or AR.

All **208 original matcher signatures, arguments and order remain unchanged**.
The 370 px phone canvas requirement, geometry, persistence, working membership,
canonical save, cancellation and Undo/Redo outcomes were not reduced. The exact
SC-00C Library component/test blobs from `f7b0737acc2d` remain unchanged.

## Actual menu cause and repair

The first four-path run on `43171b3a6bdd0e863cb56f6dd52b55161429aaa3` fails
construction and exclusions at **Save draft**, while the other two cases pass.
Unlike the earlier diagnostic, this captures the failing sequence without a
pre-gesture wait. Its original `header-menu-events.json` files are preserved
under that attempt's `originals/test-results` directories.

The header menu chose the nearest focusable ancestor of the clicked title:
`DIV.product-shell-content`, outside the header and Studio. Its recorded ancestor
positions therefore omitted `MAIN`. A queued Studio scroll at `left: 1` arrived
about six milliseconds after menu opening. It was classified as untracked and
dismissed the menu. This explains the captured editor failure; it says nothing
about the separate physical Chronicle Lens calibration problem.

The repair bounds opener lookup to the context area that owns the event. An
outside page wrapper is no longer selected as that area's opener, and the
Studio header is a programmatic focus target. The correct Studio scroll
ancestors now participate in the existing settled-position comparison.
Actual later scrolling still dismisses the menu. No grace timer, click retry,
settlement wait or relaxed scroll contract is introduced. All temporary event
instrumentation is removed from the final source and test helpers.

The new three-test regression covers a focusable outer page wrapper, a queued
already-settled Studio scroll, actual later movement and Escape focus return.
The queued-scroll case **fails before the repair**; the other two pass. All
three pass afterward. The original before/after logs and exact committed test
blob identity are retained. This is deterministic DOM regression proof,
separate from the production browser runs.

## Inspector corrections

- Direct-placement opens the selected object's existing Properties directly,
  rather than searching for the retired Overview / Identity disclosure.
- Exclusion-zone tools are reached through **Spatial context**. Choosing a zone
  opens its Properties; the existing real-gizmo, shape, delete, hidden-outside-
  editing, light/reduced-motion, phone and saved-reload checks remain intact.
- Parametric-room additions use **Spatial context**, and exact coordinates use
  Engineering. Direct correction buttons and the folded phone View & audio
  entry replace retired disclosure navigation. Part counts, support protection,
  known scale, Undo/Redo, working save and phone reload checks remain intact.
- The selected item's Inspector title is again a semantic heading. Explicit
  style rules preserve its previous size, weight and spacing. The original
  phone heading assertion is fulfilled rather than weakened to ordinary text.

The existing Creator guide was reviewed: its Properties/Spatial context/mode
directions already describe these controls correctly. No new workflow or
parallel editing/save command is introduced.

## Retained production browser runs

| Attempt suffix | Source | Pass | Fail | Not run | Purpose |
| --- | --- | ---: | ---: | ---: | --- |
| 155823-d4f53cfa | `43171b3a6bdd` | 2 | 2 | 0 | Actual header failure and minimal event capture |
| 160140-dbffe535 | `3dedbb9cd10e` | 4 | 0 | 0 | Uninstrumented four-path proof |
| 160259-9774ee39 | `3dedbb9cd10e` | 11 | 0 | 0 | Uninstrumented complete combined batch |

Each folder contains its original invocation, complete browser log, JSON report,
runtime/profile, native archive manifest and actual captured artifacts. The
[evidence manifest](evidence-manifest.json) records byte hashes and exact
candidate identities. The [preceding partial checkpoint](../library-entry-repair-20261017/README.md)
and all its failed results remain unchanged; instrumented historical passes are
not rewritten as repaired-source proof. Runner warnings remain in the raw logs.

The combined run's fresh `animation-phone-layout.json` records **370 px** canvas
height, a **48.5 px** selection card and **zero horizontal document overflow** at
390×844. This is new source-bound evidence, not a rebound 41b measurement.

## Independent local rendered review

The [four-path review](independent-local-review/independent-local-review.json)
inspects all 23 focused screenshots and four complete recordings through 201
samples across 39.12 seconds. It records all 17 dimensions and no actionable
finding within the four journeys. Exact geometry/persistence semantics remain
supported by assertions rather than inferred solely from pixels. Its initial
measurement limit correctly reflects that focused packet; the combined run
supplies the distinct current-source layout receipt above.

The [current Library addendum](independent-library-review/independent-local-review.json)
separately inspects four screenshots and the complete current Library recording
through 87 samples. It records no actionable bounded finding, then reads the
fresh combined phone receipt. Earlier 41b and 673 reviews retain their original
identities. Actual source-bound media, sampling manifests and contact sheets are
committed alongside these supporting reviews.

These are independent **local** critiques. They are not trusted capture,
protected qualification, a complete screen-reader/keyboard audit, whole-product
usability, physical Safari/AR or owner acceptance.

## Remaining external boundary

Read-only GitHub verification still finds #721 open/draft at `43b5f4d55b6a`, with
no merge commit or merged date. Root does not dispatch protected #722 capture,
qualification, mainline reconciliation or merge. The designated cloud task alone
owns Crossdeck/Reach/systemic workflow execution. Fresh complete-candidate
qualification and landed proof remain required after the accepted dependency.

The real upright steady iPhone session remains failed with unknown cause. Both
current prototype providers return no admitted planes; stable mapping, detected
surfaces, physical alignment and walk-around anchoring remain **UNQUALIFIED**.
No shared pilot is restarted. No paid inference, private photographs, real keys,
shared owner database, dependency change or provider/license change is used.

This is ordinary corrective work, so no Feature Catalog capability or
availability promotion is warranted. Human documents use frontmatter; original
tool outputs/media are engineering evidence under this folder, and active
continuation instructions remain in `.agents`.
