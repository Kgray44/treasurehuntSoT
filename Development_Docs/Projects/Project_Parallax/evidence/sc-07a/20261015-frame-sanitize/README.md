---
title: SC-07A legacy Environment frame sanitization evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-legacy-environment-frame-sanitization-20261015
last_reviewed: 2026-10-15
---

# Legacy Environment frame sanitization

Product and browser-test source `5b0f6b3a05d4110462b90f984bc0f20be6fd18e6` replaces a legacy synthetic Environment's source `evidence.frameId` with `community-simulated` in its server-reviewed Community package. The byte-level package test sets the source frame to `private-room-photo.jpg` and verifies that identifier is absent from the public JSON while semantic placement candidates remain available. This closes one metadata leak; it does not establish that manually authored geometry is safe to disclose.

The focused package suite passed **13/13**, a fresh isolated Harborlight publication and installation suite passed **6/6**, TypeScript passed, targeted ESLint passed, and documentation validation passed. The exact-head task-owned production Chromium [run](full-browser.log.txt) passed **11/11** SC-07A journeys. The [suite profile](browser-suite-profile.json), [runtime receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) report PASS, including owned browser and server cleanup with ports released. Synthetic accounts and content used a fresh isolated SQLite database and production build.

The prior [reviewed package captures](../20261015-review-labels/README.md) show the wizard and its rendered Scene and Environment labels on their recorded earlier source. The current run verifies the full executable journey on the frame-sanitized source; it is local software evidence. Formal Product Experience capture and independent review, protected Sounding Line qualification, real-device presentation, and owner acceptance remain open.

Test and documentation continuation `1e3c8f1620b3b36fa4d2b4726c054659ce68ad48` strengthens the ordinary saved-Asset journey without changing product source `5b0f6b3a05d4110462b90f984bc0f20be6fd18e6`. It explicitly enters tags, selects the canonical remix-with-attribution license, adds a second credit, sees the Community-after-approval visibility and reviewed credit, and checks persisted listing tags, release license and attribution. TypeScript, targeted ESLint and documentation validation passed. Its fresh isolated production Chromium [run](explicit-rights-browser.log.txt) passed **11/11**; the [suite profile](explicit-rights-suite-profile.json), [runtime receipt](explicit-rights-runtime.json) and [Playwright result](explicit-rights-playwright-last-run.json) report PASS and owned cleanup with ports released. This is additional local journey proof, not protected Product Experience or owner acceptance.
