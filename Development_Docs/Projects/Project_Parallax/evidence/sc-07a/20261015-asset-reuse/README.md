---
title: SC-07A saved Asset installation and credited reuse evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-saved-asset-reuse-evidence-20261015
last_reviewed: 2026-10-15
---

# Saved Asset release to credited private Scene copy

Product and browser-test source `058b901a60e93c720b1b07c65c532e06cbcb46b5` permits a saved Library Asset to publish, install as a pinned read-only Harborlight release, and enter a second Creator's private Scene as a credited copy when the immutable license allows modification. The server validates the saved Asset or Assembly classification and working-source checksum before using a released version without a generated `libraryDefinition` marker. The insertion still refuses Environment bindings, calibration, fixed real-world anchors, referenced media, Vision data, adaptive content and nested placed-source instances. The receiving Scene records the exact installed definition and version while the installation remains read-only.

The first [failed browser attempt](first-browser-failure.log.txt) on `b559ade74c215e939b58479116556ff40ee9895f` tried to click a catalog card beyond the first page; the exact installed detail was available through its deep link. The second [failed attempt](saved-asset-refusal.log.txt) on `f2fed45c97c3ba996aeb8c1913edb1b8fd049976` reached **Add credited copy** and exposed the product refusal for a saved Asset without the generated marker. Both failures are retained rather than counted as passes.

The corrected [focused production Chromium journey](focused-asset-reuse-pass.log.txt) passed **1/1**, followed by the [complete SC-07A suite](full-sc07a-pass.log.txt) passing **11/11** on exact source `058b901a60e93c720b1b07c65c532e06cbcb46b5`. Each used a fresh isolated generic-profile SQLite database, a production build and synthetic identities. The [suite profile](browser-suite-profile.json), [runtime and cleanup receipt](browser-runtime.json) and [Playwright result](playwright-last-run.json) report PASS, including owned browser, server-tree, proxy and port cleanup.

The inspected [private Scene reuse capture](asset-reused-desktop.png) shows the credited confirmation, two Scene objects and the pinned installed Asset selection. Browser assertions verify the saved Scene's placed-source record and the unchanged read-only installation. The focused reusable-asset unit suite passed **12/12**; TypeScript and targeted lint passed. The capture is local software evidence and does not establish real-device presentation, independent Product Experience review, protected Sounding Line qualification or owner acceptance.
