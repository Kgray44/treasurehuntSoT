---
title: SC-07A saved source type labels local browser proof
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-source-type-labels-20261015
last_reviewed: 2026-10-15
---

# Saved source type labels

The SC-07A draft at `e19d7d7a89d9ea05b90836798f863161badf933b` labels the selected saved source type and revision on the first **Publish to Community** step. Its [production Chromium run](browser.log.txt) passed **11/11** direct Harborlight publishing journeys on that exact committed source, including first-step assertions for saved Assets, Scenes, Environments, effects and compositions. The [suite profile](browser-suite-profile.json) reports PASS, and the [runtime receipt](browser-runtime.json) reports capture and task-owned browser/server cleanup PASS. The runner used a fresh isolated SQLite database under this D: worktree, synthetic Creators and a production build.

The [desktop Scene capture](scene-content-desktop.png) visibly distinguishes the saved **Spatial Scene · revision 2** from its self-contained **Spatial asset** Community release when no Environment is pinned. The [390 px Asset capture](asset-content-mobile.png) shows **Spatial asset · revision 2** above the preview and clear of the fixed footer. The browser tests assert the other three source labels; this record does not include first-step screenshots for them.

The [first run](browser-attempt1.log.txt) passed the first journey and stopped on an outdated test expectation in the update journey: it expected `SAVED SOURCE · REVISION 3` while the rendered product correctly showed `SAVED SPATIAL ASSET · REVISION 3`. The assertion was corrected in the next commit and the full suite reran. That failed receipt remains part of this record.

The earlier [R6 combined local rehearsal](../20261015-combined-r6/README.md) is bound to its earlier three-way source and is not proof of this exact head. These runs are local software evidence. The new label has not received separate independent Product Experience review or protected Sounding Line qualification, and they do not establish real-device presentation, live scanner behavior, safe disclosure of an actual home layout, or owner acceptance.
