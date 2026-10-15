---
title: SC-00C filtered composition reuse browser rerun
audience: product-engineering
status: focused-local-browser-pass-pending-final-source
canonical_for: sc-00c-filtered-composition-reuse-20261015
last_reviewed: 2026-10-15
---

# Filtered composition reuse browser rerun

The prior combined [attempt 3](../../sc01/root-integration-20261015/studio-browser-attempt3/packet.json) failed when the Source filter briefly retained both the built-in and saved Ghostly Presence cards. The corrected Library fences displayed cards to the active query before accepting an action. This focused production Chromium rerun passed **1/1** on candidate `9d1c7227a8bdf333bf30a2ccdd0a8da40d885fda` with a fresh task-owned SQLite database and a synthetic Creator.

The [tracked browser test](../../../../../../tests/e2e/parallax-sc02-integration.spec.ts) added a real Treasure chest model, Point light, and Ghostly Presence composition; saved the composition; filtered to My Creations; selected the single saved result; reused it; reloaded the Scene; and checked two audio voices during rendered playback. The [browser log](browser.log.txt), [observations](observations.json), [desktop insertion](combined-chest-desktop.png), [composition playback](combined-composition-playing.png), [phone Library](combined-library-phone.png), and [phone view controls](combined-view-controls-phone.png) are retained. The page recorded no JavaScript errors. Physical device and owner acceptance were not exercised.

The production build was made at `e8abcfdad`, immediately before merging protected main `48296fbf2` into the candidate. That merge changed only `scripts/sounding-line/experience-browser.mjs`, leaving product source unchanged for this focused rerun. The browser result is useful repair evidence, but the full 12-journey suite and SC-07A integration must be rerun on one final built source before acceptance.
