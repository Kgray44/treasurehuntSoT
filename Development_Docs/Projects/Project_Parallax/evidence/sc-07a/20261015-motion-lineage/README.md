---
title: SC-07A animation and reuse rights correction evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-motion-lineage-evidence-20261015
last_reviewed: 2026-10-15
---

# Animated content and placed reusable asset rights

Exact product and browser-test source `61f146dd590eaea17fc9ceedef95a999f370570b` retains validated local animation tracks in the server-allowlisted spatial package. Earlier packages silently omitted them, so an installed Effect or Composition could lose authored motion. The source also refuses placed reusable asset instances until their pinned source licenses and package dependencies can be verified. The Creator sees that specific limit in Library, and the server enforces it independently; copied content cannot silently discard its reuse lineage and publish as wholly original work.

The focused package suite passed **12/12**. A fresh isolated SQLite bootstrap and the Harborlight publication and installation integration suite passed **5/5**; its first journey verifies the exact opacity animation track in both the reviewed package and the second Creator's read-only Library copy. TypeScript and targeted lint passed.

The [focused production Chromium Effect journey](focused-effect.log.txt) passed **1/1**. The [complete SC-07A production Chromium suite](full-sc07a.log.txt) then passed **11/11** on the same exact source with a separate fresh generic-profile database, a production Next.js build and synthetic accounts. The [suite receipt](browser-suite-profile.json), [runtime and cleanup receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) report `PASS`, including owned browser, proxy, server-tree and port cleanup. The [installed Effect capture](effect-installed-desktop.png) was inspected and shows the correct Effects Library card and read-only Community origin. It is surface evidence; the package and installed-record assertions establish motion data preservation, not rendered animation quality.

This correction does not resolve third-party reuse licensing or binary scanner availability. Dependency-closed owned Compositions without placed reusable asset instances remain publishable. The [formal planner attempt](experience-plan-blocked.log.txt) on exact product source `61f146dd590eaea17fc9ceedef95a999f370570b` and protected base `670706e875eeac61031f08f69595db2dc9a81879` still stops at the separately owned Crossdeck Phase 2 continuity intent. Formal Product Experience capture and independent review, protected Sounding Line qualification, real-device presentation and owner acceptance remain open.
