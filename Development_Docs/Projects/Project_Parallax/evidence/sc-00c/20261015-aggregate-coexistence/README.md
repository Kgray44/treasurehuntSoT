---
title: SC-00C and Chronicle Lens aggregate coexistence observation
audience: product-engineering
status: local-coexistence-evidence-only
canonical_for: sc-00c-chronicle-lens-aggregate-coexistence-20261015
last_reviewed: 2026-10-15
---

# Aggregate coexistence observation

The task-owned aggregate commit `714f58c82e2468306cda4a9ba824343877801bb8` combines the unaccepted SC-00C/SC-07A candidate with the separately reviewed Chronicle Lens recovery change. Its [production build](production-build.original.log.txt) passed with `FOREVER_VALIDATION_ISOLATION=1` and a fresh SQLite database under this worktree's ignored `artifacts/sc00c` directory. The source is neither draft PR #736's exact head nor draft PR #722's exact head; this receipt is **coexistence evidence only**.

The first [mixed Chromium invocation](mixed-suite-attempt.original.log.txt) passed **16 SC-00B/SC-00C/SC-01/SC-02 cases** in one production server on private port 3244. The next SC-07A test stopped before its product assertion because its test guard requires an SC-07A-named task database and `SOUNDING_LINE_TASK_OWNED_HTTP=1`. Both Chronicle Lens cases stopped before product assertions because `PARALLAX_A1_SOURCE_SHA` had not been set. Playwright therefore reported 16 passed, three failed at isolation guards, and four not run. The log is retained without recasting this as a product failure or a full combined pass.

The separate [Chronicle Lens retry](phone-retry.original.log.txt) set the exact aggregate source SHA and task-owned HTTP marker, used another fresh isolated SQLite database and private port 3245, and passed **2/2 desktop and 390 px phone Chromium cases**. These are synthetic browser observations. The [phone recovery evidence](../../browser-tracking-recovery-20261015/README.md) keeps the independent review and original failed attempts. Physical iPhone calibration, sustained anchoring, SC-07A's current installed-item review correction, exact PR-head qualification, protected admission and owner acceptance remain open.
