---
title: SC-00C final draft PR candidate browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-00c-pr736-final-browser-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-00C and SC-07A draft candidate browser evidence

The final tested code and contract source was
`56ffcc596daafe41996aee2592bf2fa8809c58da`, based on
draft [PR #736](https://github.com/Kgray44/treasurehuntSoT/pull/736)'s frozen
SC-07A handoff `061ede4a35416d5b5aeb3f7c1dce4360a0755d54`. The new commit
adds focused SC-00C browser assertions, adapts pre-refit lifecycle tests to the
current visible Library, and registers the SC-00C/SC-07A suites in the Parallax
experience contract. Its product implementation is unchanged from `a7e0967d3`.

The [production build](build.log.txt) passed. On isolated SQLite databases and
private loopback servers, production Chromium passed the [25-case combined
consumer and lifecycle suite](core25-browser.log.txt), the separate [five-case governed
Community suite](sc07a-browser.log.txt), and the [2,000-Scene scale
journey](scale2000-browser.log.txt). The 25 cases cover SC-00B Inspector,
SC-01 Scene Manager and Environment Library, SC-02 insertion/reuse, and
SC-00C direct Library journeys, plus legacy lifecycle, CAS retry and all three
Environment creation entry paths. The five Community cases cover private-to-
approved publication and immutable install, reviewed Environment geometry and
private metadata, owned Environment publication/install, refusal of unlicensed
physical content, and an uncertain response with exact retry.

The direct Library screenshots from `56ffcc596` show [built-in search and preview](screenshots/56ffcc596daa/built-in-asset-preview.png),
[immediate inserted selection](screenshots/56ffcc596daa/built-in-asset-selected.png),
[an owned Environment](screenshots/56ffcc596daa/saved-environment-preview.png),
[its associated Scenes](screenshots/56ffcc596daa/associated-scenes.png),
[a renamed Scene retaining its Environment pin](screenshots/56ffcc596daa/scene-renamed-with-environment-pin.png),
[favorite and collection discovery](screenshots/56ffcc596daa/favorite-collection-filter.png),
and [keyboard insertion on a 390 px viewport](screenshots/56ffcc596daa/keyboard-context-add-phone.png).
The unprefixed direct screenshots in this folder retain the earlier
`dde8f28f5` run and are not the final-source captures.
The Community publication and installed-return screenshots remain in the
[SC-07A source-bound evidence](../../sc-07a/20261015-readonly-return/README.md).

The [first extended lifecycle attempt](lifecycle-attempt1-stale-harness.log.txt)
at `dde8f28f5` passed four cases and failed four before their product assertions
because they still named the previous Library, Scene identity and Environment
entry controls. A [second attempt](lifecycle-attempt2-stale-choice.log.txt)
passed seven cases and exposed the remaining old Environment chooser name.
The [focused final repair](environment-entry-focused-pass.log.txt) then passed
that case. All original failed logs are retained; neither failed attempt is
counted as a final pass.

The [scale report](browser-scale.json) records 2,000 synthetic minimal saved
Scenes with five immutable releases each. The first Library page returned 48
cards in 26,345 bytes. Show more rendered 96 cards; far-end search took 945 ms.
Keyboard detail inspection worked at a 210 px panel; the panel also worked at
420 px. The 390 px [phone capture](screenshots/56ffcc596daa-scale/2000-scenes-phone.png) had no
horizontal document overflow. [Desktop](screenshots/56ffcc596daa-scale/2000-scenes-desktop.png),
[narrow panel](screenshots/56ffcc596daa-scale/2000-scenes-narrow-panel.png), and
[wide panel](screenshots/56ffcc596daa-scale/2000-scenes-wide-panel.png) captures retain the
rendered catalog. The unprefixed scale screenshots retain the earlier
`dde8f28f5` run. The full Studio bootstrap was 23,990,373 bytes; its 3,724 ms
heading-ready measurement on one local run does not establish acceptable
network, memory, or device performance. The first-page projection is paged,
but the full Studio bootstrap remains a measured scale limitation.

The runs used `FOREVER_VALIDATION_ISOLATION=1` and
`SOUNDING_LINE_TASK_OWNED_HTTP=1`, fresh `validation-isolated-sc07a-*.db`
files for the core and Community suites, and a fresh database under
`artifacts/sc00c/scale-browser/` for the scale journey. The production Chromium
servers used private loopback ports 3256 (25 cases), 3257 (Community) and 3258
(scale), each with one worker. These are browser/software results,
not owner product acceptance or physical-device proof. The canonical Product
Experience planner still rejects this candidate with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`;
the separately owned Crossdeck/Parallax design contract and protected replay
remain open. The `testing/contracts.json` Parallax browser list now includes
the five SC-07A cases and the SC-00C direct journeys, but the trusted visible
Creator-to-moderator-to-installer capture/replay journey still needs the
SC-07A owner's additive contract design. This local test evidence cannot
substitute for that mapping. The old trusted reusable-definition journey also
references a pre-refit Library button and requires a governance-compatible
resolution before protected replay can pass; this branch has not altered or
silently removed that baseline obligation.
The [planner failure receipt](experience-plan-block.log.txt) records the exact
current gate.
