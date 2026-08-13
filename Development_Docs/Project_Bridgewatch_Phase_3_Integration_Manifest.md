---
title: Project Bridgewatch Phase 3 Integration Manifest
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-integration
last_reviewed: 2026-08-13
---

# Project Bridgewatch Phase 3 Integration Manifest

## Status: not yet accepted into main

| Field                          | Current value                                             |
| ------------------------------ | --------------------------------------------------------- |
| Starting protected main        | `191a964488d0df71f8dcb91c5b8372fc73b6b32e`                |
| Current Phase branch           | `codex/project-bridgewatch-phase3-keep-the-watch-6`       |
| Reconciled base                | `60b89841986e66fbc2c0828489d38002a1617506`                |
| Frozen candidate               | `e960db8c...` was invalidated by authority failure        |
| Pull request                   | [#83](https://github.com/Kgray44/treasurehuntSoT/pull/83) |
| Authority gate                 | `mainline`                                                |
| Required protected context     | `Sounding Line / Mainline Decision`                       |
| Canonical decision and cleanup | `31714713467` `EVIDENCE_INVALID`; all cleanup `CLEAN`     |
| Protected merge / final main   | pending                                                   |

The Phase 3 implementation was replayed after the historical external Helm
browser failure was resolved by Helm's independently protected correction and
after the ordered Deepwater record-only closure, then reconciled after
Shipwright Phase 2 and again after Wakebook Phase 1 protected-merged. The
earlier `-4` candidate received `RELEASE_GO` only for its exact old base and is
retained as historical evidence. The subsequent `-5` candidate received one
hosted-only `component.studio` invalid receipt in run `31668485208`; it was
never retried. After Tideglass Phase 3 accepted/reconciled records advanced
protected main, the implementation was replayed on this `-6` branch. This
candidate must not edit the remaining pending facts speculatively. It is updated
only after its own frozen candidate is bound to the current protected-main
process and after a fresh post-merge fetch proves the merged ancestry.

The `-6` candidate's first authority, `31714713467`, was `EVIDENCE_INVALID`
only because its source-bound `browser.helm` receipt failed; its 37 other
mandatory receipts and every cleanup receipt were clean. The governing
smallest-scope local reproduction and hosted focused repair `31716941169`
both passed the same 3 Helm cases on unchanged `e960db8c...`. That evidence
does not revive the invalidated candidate or substitute for a finalizer; this
manifest remains unaccepted until a fresh candidate completes a new exact-SHA
authority and protected merge.

Phase 3 materially extends the existing `FT-035` Bridgewatch signal-projection
capability. The current fragment correctly records its accepted Phase 2
mainline state and cannot be altered to claim Phase 3 availability before this
protected integration. After merge, the record-only closure updates that same
owning fragment with exact mainline evidence; no speculative feature ID or
branch-complete duplicate is created.
