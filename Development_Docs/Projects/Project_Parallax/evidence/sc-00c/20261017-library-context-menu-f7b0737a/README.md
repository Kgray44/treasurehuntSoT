---
title: SC-00C Library context menu and phone placement evidence
audience: product-engineering
status: local-browser-pass-pending-root-integration
canonical_for: sc-00c-library-context-menu-20261017
last_reviewed: 2026-10-17
---

# Library card actions and viewport return

Exact local candidate `f7b0737acc2dccc46a87770ec7bfd02ebf28f09c`
combines the bounded SC-00C card-action change with the root-owned Studio menu
scroll correction (`9d2526ba9f6e57ee08a5a3314c3d998ef422d087`) and narrow-screen
viewport return (`37b03ba6ee67d8f3c20a1d0fa8652821d8a605c0`). This is an
isolated rehearsal, not the final Parallax root PR #722 source.

The [original production-browser log](browser.original.log.txt),
[suite profile](browser-suite-profile.json), [runtime receipt](browser-runtime.json)
and [journey video](journey.webm) record **1/1 passing** Chromium case on a fresh
task-owned SQLite database with one worker. Browser, server and proxy cleanup
and port release all report `PASS`. The test opens a built-in Asset's card menu
with an unguarded right-click, adds it through the same Library insertion path,
checks Scene receipt and selection, then undoes it. It checks that Archive is
disabled for the open working Scene; Shift+F10, Escape and focus restoration;
and dismissal after an actual changed-position Library scroll.

At 390 px in light theme and reduced motion, the same test opens an expanded
Asset card's keyboard menu, checks that it stays within the viewport, selects
**Place in Scene**, and checks that the overlay closes with the placement
preview **in the visible viewport** and Undo still disabled. The reviewed
[built-in menu](built-in-context-desktop.png),
[current-Scene menu](current-scene-context-desktop.png),
[expanded phone menu](expanded-phone-context-light-reduced.png) and
[phone placement return](context-placement-preview-phone.png) show those states.

The [diagnostic failed run](browser.scroll-diagnostic.log.txt) on earlier source
`615dbd5e5a28ffa0ba3063b4e06c58151c51b3ff` recorded a `leftPane` scroll
notification after menu creation and immediate menu removal. The final test
has no artificial scroll-settlement delay. The shared hook now ignores only
queued notifications for scroll positions already captured when the menu
opened; a new external scroll still closes it. The SHA-256 [manifest](manifest.json)
binds the copied local evidence files.

This focused case does not replace the wider SC-00C/SC-07A/Parallax browser
suite, root merged-candidate replay, protected Product Experience review,
physical-device qualification or owner acceptance.
