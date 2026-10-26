---
title: SC-00C pointer-aware physical asset drop local evidence
audience: product-engineering
status: local-browser-pass-pending-combined-integration
canonical_for: sc-00c-pointer-aware-physical-drop-local-evidence
last_reviewed: 2026-10-15
---

# Pointer-aware physical asset drop

This isolated SC-00C correction uses the renderer's visible, safe candidate surface under a dragged physical Library card. The existing physical insertion planner receives both the pointer's world position and that candidate's identity. If the chosen support cannot fit the model, insertion fails instead of moving it to a different support. The Library still offers click-to-add through its existing automatic placement path. Nonphysical presets retain their authored starting positions and state that behavior during drag.

The [held-drag screenshot](pointed-floor-preview.png) shows the candidate floor highlight and fit-check message before release. The [post-drop screenshot](pointed-floor-insertion.png) shows the selected Treasure chest in Properties and the explicit message after a second drop outside the room left the object count unchanged. Both screenshots come from the authenticated product on a synthetic Creator account and synthetic Bedroom Scene; no private content was used.

Focused planner/insertion Vitest checks: **49 passed** in two files. Changed-source ESLint and full TypeScript passed. The task-owned Turbopack production build completed. The Chromium journey in `tests/e2e/parallax-sc00c-drop-placement.spec.ts` passed **1/1** against that build, using an isolated SQLite database and port 3189. It checked held-drag support preview, one inserted and immediately selected model, Undo/Redo, and an invalid point that inserted nothing. Earlier browser attempts failed on test locator, offscreen source-card and overlay-target coordinates; the final run corrected those test inputs without changing product behavior.

The browser build was based on combined root `17df8def6164322d15e7907c1dd16801440361bf` plus this branch's source changes. SHA256 at build time: `SpatialCanvas.tsx` `0fbffe104f41f0d7247015ab0ace9e88354e21d356a8d3590f3ca347e365262a`; `SpatialStudio.tsx` `999c84dba417e73413fa661721155e8d62e92b54c22cd8563da225523848ee90`; `spatial-workstation.ts` `679694736b3a156ecc9d440acfce152dd0b820d445574aab28b5942e654beeb2`; `element-insertion-placement.ts` `9b7e46fc29c36a61f13151ea45df227571e87909b7cd5d82d310d0513017d47e`; `element-insertion.ts` `e4bd03a12a19b007491c8c31913e6a41d3869668aaf54d7d0d4f40fb7bd447a4`.

This proves one local fixed-Scene physical drop path, not the final combined paged Library, every model/surface combination, real-device placement, protected qualification or owner acceptance. The combined host must rerun this journey after the SC-01 and SC-07A integrations.
