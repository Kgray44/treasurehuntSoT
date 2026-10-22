---
title: Sextant Phase 4 bounded consumer source preparation
audience: engineering
status: source-preparation-not-executed
canonical_for: sextant-phase4-bounded-consumer-source-preparation-20261022
last_reviewed: 2026-10-22
---

# Bounded consumer source preparation

The existing combined development target selects four consumer cases with
180-second limits and eight contextual-entry cases with 90-second limits.
Their declared case limits total 1440 seconds before preparation inside the
unchanged 1200-second hosted job. This does not establish that an individual
case is slow; it prevents claiming a whole-job budget from those limits.
Historical failed/cancelled runs retain their original outcomes and receipts.

Two additive fixed targets select each complete original spec independently:

| Target                   | Complete original spec                              | Cases | Per-case limit | Sum of case limits |
| ------------------------ | --------------------------------------------------- | ----- | -------------- | ------------------ |
| sextant-consumer-pages   | tests/e2e/sextant-consumer-journeys.spec.ts         | 4     | 180 s          | 720 s              |
| sextant-contextual-entry | tests/e2e/sextant-contextual-entry-journeys.spec.ts | 8     | 90 s           | 720 s              |

The canonical hosted dispatcher and configured browser share this closed mapping.
Each target is development-only and refuses selected scenarios or profiles.
The original combined target, both specs, fixture safeguards, assertions,
3000-ms feedback limits, capture/private-publication behavior, process guardian
and job watchdog remain unchanged. Across both targets all twelve original
cases are retained exactly once; no aggregate passing result exists yet.

The proposed per-job planning allocation is 240 s runner setup, 180 s application
preparation/readiness, 720 s case limits and 60 s cleanup/media/publication.
This declares two separate 20-minute jobs, 40 minutes in aggregate; it does not
fit the original combined obligation into 20 minutes or reserve execution
authority. Allocations are estimates, not enforced stage maxima. Hooks, failure
diagnostics and cleanup remain reasons an observed job can fail its watchdog.

Freeze committed source and obtain independent mapping and whole-budget review
before any dispatch. Source-only tests must prove that nondevelopment tiers and
caller-selected scope are refused before source lookup or remote mutation.
Fresh source planning, one-shot intent, actual setup observation, case receipts,
artifact integrity, cleanup/port proof and independent rendered review remain
required. Prior f0ef1893 Resources/Admiralty evidence stays bound to that source.

This is internal development infrastructure preparation, with no completed
product capability or availability change. Feature Catalog: NO CHANGE REQUIRED.
Formal native, protected-main, physical and owner acceptance remain open.

[Sextant evidence navigation](README.md) and
[active automation scope](../../../../.agents/sextant-phase4-bounded-consumers.md).
