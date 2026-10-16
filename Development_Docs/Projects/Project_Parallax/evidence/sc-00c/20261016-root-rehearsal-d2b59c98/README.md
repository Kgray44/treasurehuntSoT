---
title: SC-00C current Parallax root rehearsal browser evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-00c-root-rehearsal-browser-evidence-20261016
last_reviewed: 2026-10-15
---

# Current SC-00C, SC-07A and Parallax root rehearsal

Exact committed product and test source `d2b59c98cbd2eaa06541d2687a090e8a03533255`
locally merges SC-00C draft PR #739 head `a4fd2da9fabbd6c1d9dec7d836ed451ccf843abc`
(which contains SC-07A PR #736 head `9c6de12a34f7391607eb26df37752dcdc82c60ed`)
with Parallax root PR #722 head `325a0c5d2f37ee975d16527960048815ee8edcf9`.
The one textual merge conflict was in current product status; it was resolved
before the browser runs. The expanded Library component and styles are
identical to PR #739's source. This is a local combined rehearsal, separate
from the two owners' draft PR heads and protected main.

The generic Sounding Line browser-suite runner built that source with a
one-worker production Next build and a fresh task-owned SQLite database under
the D: worktree. It ran the five Library, placement, lifecycle and Harborlight
specs with one Chromium worker. All **27/27** production browser cases passed
on the exact committed source. The [original log](browser.original.log.txt),
[suite profile](browser-suite-profile.json), [runtime receipt](browser-runtime.json)
and [Playwright result](playwright-last-run.json) retain the result. Capture,
browser/server/proxy cleanup and port release report `PASS`.

The journeys exercise compact-to-expanded browsing and back, authoritative
surface placement with preview and immediate selection, saved physical Asset
placement and cancellation, keyboard actions, Environment-to-Scene navigation,
working/saved lifecycle and retry, desktop/narrow/phone layouts, dark/light
themes, reduced motion, catalog-error recovery, and private/published/installed
Harborlight paths. The [desktop expanded capture](expanded-desktop.png) visibly
places Source, Show and Sort together in the slim toolbar above the gallery.
The [narrow capture](expanded-narrow.png), [390 px phone capture](expanded-phone.png)
and [light reduced-motion capture](expanded-light-reduced.png) show the other
presentations. [Placement preview](placement-preview.png),
[selected insertion](placed-selected.png),
[Scene relationships](expanded-scene-relationships.png), and
[built-in Asset inspection](built-in-asset-preview.png) preserve key transitions.
These screenshots were inspected directly after the run.

A separate fresh task-owned database and production build on the same source
passed the **1/1** 2,000-Scene scale browser case. The
[scale measurement](browser-scale.json) records five indexed releases per
Scene, zero full release bodies at bootstrap, 48 first-page cards in 26,371
bytes, 96 after Show more, one selected-detail read after expanded opening,
zero gallery canvases, 154 ms expanded opening, and 944 ms far search inside
the expanded Library. The 390 px phone document measured 390 px. The repeated
authenticated whole-Studio bootstrap was 6,626,373 bytes and reached its
heading in 3,492 ms locally; this remains a measured performance cost, not a
network or device promise. The [original scale log](scale-browser.original.log.txt),
[suite profile](scale-browser-suite-profile.json),
[runtime receipt](scale-browser-runtime.json),
[Playwright result](scale-playwright-last-run.json),
[expanded desktop](2000-scenes-expanded-desktop.png), and
[expanded phone](2000-scenes-expanded-phone.png) preserve the separate run.
The remaining [desktop](2000-scenes-desktop.png),
[narrow panel](2000-scenes-narrow-panel.png),
[wide panel](2000-scenes-wide-panel.png) and
[phone](2000-scenes-phone.png) captures show the Studio context.

The [manifest](manifest.json) records SHA-256 and byte length for every copied
original receipt and image. The synthetic database itself remains in the
task-owned ignored artifacts directory. These local Chromium runs do not grant
protected Product Experience qualification, live-photo reconstruction, physical
AR or device/network performance acceptance, or owner acceptance.
