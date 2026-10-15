---
title: SC-00B failed effect browser attempt at 61630fc5
audience: product-engineering
status: preserved
canonical_for: parallax-sc00b-failed-effect-attempt-61630fc5
last_reviewed: 2026-10-15
---

# Failed effect browser attempt at 61630fc5

The task-owned production Chromium suite at `61630fc5121f8945e8e38d88699ffdac0ac42adb` returned **FAIL**: three journeys passed and the new effect/keyboard journey failed. The failing assertion was `getByText("Phenomenon style", { exact: true }).toBeVisible()` in `tests/e2e/parallax-sc00b-combined.spec.ts`. Playwright's DOM snapshot showed the selected Portal phenomenon and a present `combobox "Phenomenon style"`. The label text was part of the accessible select label, not a standalone text node. The test was corrected at `89a08310913cee254e4c0600a8dd2d29a5d4a3e5` to locate the combobox by role and accessible name. All four journeys then passed; the later `f1e69e17` five-journey run also passed.

The first attempt's Playwright screenshot, trace, video, and suite receipt were overwritten by later task-owned reruns before being copied to this evidence directory. They are unavailable in this worktree. This record preserves the observed failure and its limit; it is not a reconstructed authority receipt or a passing result. The later passing `f1e69e17` media and receipts are preserved separately here.
