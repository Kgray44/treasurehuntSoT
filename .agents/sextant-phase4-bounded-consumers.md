---
title: Sextant fixed consumer development partitions
audience: automation
status: source-preparation
canonical_for: sextant-phase4-bounded-consumer-development-context
last_reviewed: 2026-10-22
---

# Fixed consumer development partitions

Continue the existing Phase 4 owner/chat and PR709. Preserve frozen f0ef1893,
all prior receipts, protected custody and the original combined selector.
The engineering [scope and proof record](../Development_Docs/Engineering/Sextant/Project_Sextant_Phase_4_Bounded_Consumers_20261022.md)
defines two additive, explicit development targets. No arbitrary test, scenario,
profile or nondevelopment tier is accepted by these targets.

`sextant-consumer-pages` runs the entire existing consumer spec (four cases,
180 seconds each). `sextant-contextual-entry` runs the entire existing contextual
entry spec (eight cases, 90 seconds each). Each preserves the canonical 20-minute
job watchdog, assertions, fixture ownership, private diagnostics and supervised
cleanup. The combined `sextant-consumers` target remains unchanged and held:
its declared case limits alone total 1440 seconds within a 1200-second job.

Preparation does not authorize dispatch. Before any new development attempt,
freeze exact source, run focused checks and the source plan, independently review
the partition mapping and whole-job budget, and bind a one-shot intent and exact
run observer. A proposed planning allocation per job is 240 seconds setup,
180 preparation/readiness, 720 case limits and 60 cleanup/publication. These are
estimates rather than enforced stage maxima; actual setup and cleanup must still
be observed. No automatic retry, weakened assertion, timeout increase, protected
campaign restart, physical claim or claim of full Phase 4 acceptance follows.
