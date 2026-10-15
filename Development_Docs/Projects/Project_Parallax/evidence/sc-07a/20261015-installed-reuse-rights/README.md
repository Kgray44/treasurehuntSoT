---
title: SC-07A installed reuse rights and lineage evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-installed-reuse-rights-evidence-20261015
last_reviewed: 2026-10-15
---

# Pinned license and source lineage

Product and browser-test source `3ac71aaa108e977fce552c714b4a0a87b5d8b516` checks the exact installed Harborlight release, package and immutable license snapshot before an installed Asset or Composition can enter an editable private Scene. A release that disallows modification remains installed and read-only; the Library explains why its Scene-copy action is unavailable. A permitted Composition uses the server-authorized insert path, retains a pinned placed-instance record, and leaves the installed release unchanged. Asset export refuses a subtree containing placed reusable content because a self-contained asset definition cannot carry that source lineage. Private Composition extraction preserves each intersecting placed-source reference so its Community package is refused until the rights and dependencies can be verified.

The focused [installed Composition production Chromium journey](focused-composition.log.txt) passed **1/1** on earlier correction source `474f95488187fb4494134d2569c0979aca623b3b`. The [complete SC-07A production Chromium suite](full-sc07a.log.txt) passed **11/11** on final source `3ac71aaa108e977fce552c714b4a0a87b5d8b516` with a separate fresh generic-profile SQLite database, production build and synthetic accounts. The [suite profile](browser-suite-profile.json), [runtime and cleanup receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) report `PASS`, including owned browser, proxy, server-tree and port cleanup.

The [installed Composition capture](composition-installed-desktop.png) shows the pinned read-only Library selection and a separate private Scene. The inspected [reuse capture](composition-reused-desktop.png) shows the Creator confirmation and two objects in the private Scene. Browser assertions verify the saved private Scene's placed-instance source ID and that the installed source remains read-only; the screenshots do not establish physical-device presentation quality.

The [authoring/package suites](reuse-lineage-unit.log.txt) passed **144/144** and [Library/license projection suites](reuse-rights-unit.log.txt) passed **41/41**. A [fresh isolated Harborlight integration run](reuse-lineage-integration.log.txt) passed **5/5**, exercising modification-permitted Composition reuse and refusal of both Composition and Asset Scene insertion under the configured `USE_IN_CHRONICLES_WITH_ATTRIBUTION` policy. TypeScript and targeted lint passed. Formal Product Experience capture, independent review, protected Sounding Line qualification, landed smoke and owner acceptance remain open.
