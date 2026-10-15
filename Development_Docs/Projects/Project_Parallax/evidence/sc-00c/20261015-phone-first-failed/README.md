---
title: SC-00C phone Library first capture failure
audience: product-engineering
status: failed-test-followup
canonical_for: sc-00c-phone-library-first-failure
last_reviewed: 2026-10-15
---

# First phone Library capture

The [run receipt](run.json) binds candidate `917fe5d82da5acbf9fb8a0e9100caab1c1fc83ee` (tree `898e66f7f1334099f6a023b3dcf75141c72a1214`) and reports **1/1 failed**, with source binding valid. The [browser log](browser.log), [error context](parallax-sc00c-bridge-libr-69ed1-ves-Environment-definitions-chromium-error-context.md), [trace](trace.zip), and retained recording show the exact failure: after a phone checkpoint, the test returned to a desktop viewport but left the responsive Inspector closed. The later asset-selection assertion looked for a visible Inspector and timed out. This is a test-sequence failure; the run does not prove the complete journey.

The captured [initial phone Library](sc00c-bridge-library-phone-initial.png) shows category tabs, search, collapsed secondary filters, and the first two asset cards within the 390 px viewport. The [expanded-filter image](sc00c-bridge-library-phone-filters.png) shows Source, Show, Sort, and Grid/List reachable from the disclosure. These images are observations on this local bridge source, not combined SC-02 mobile acceptance. The global header still appears compressed and remains with the SC-00 combined host review.

The next test revision restores the Inspector explicitly before its asset-selection assertion. No product-source conclusion is drawn from this failed run.
