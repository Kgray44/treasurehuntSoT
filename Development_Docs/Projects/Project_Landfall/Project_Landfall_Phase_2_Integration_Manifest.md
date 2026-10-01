---
title: Project Landfall Phase 2 integration manifest
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-integration-manifest
last_reviewed: 2026-09-30
---

# Phase 2 integration manifest

| Surface               | Phase 2 integration                                                                       | Authority                                                             |
| --------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Creator Studio        | Living Chart route, canvas/inspector, TaleDraft autosave/version, field-test API          | Creator-owned draft and existing asset library                        |
| Chronicle and Drydock | Six block contracts, validation, simulation, required-suite coverage                      | Existing Story Block registry and Drydock                             |
| One Voyage            | Typed completion provider and durable location/route/transition events                    | Pinned edition and canonical Tale Session                             |
| Player Journal        | Released map, location opt-in, fallback, status, history and replay                       | Server projection of the current published edition                    |
| Captain and Helm      | Safe status plus reveal, select, skip, confirm, pause/resume controls                     | Same session event sequence and role checks                           |
| Lanternwake           | Arrival, route and reveal scenes with reduced-motion result                               | Canonical event presentation only                                     |
| Web offline           | Public reload shell; encrypted released chart/pages/images and one expiring delivery item | Session/version/CSRF bound; authorized server reconciliation required |

The correction requires no new schema migration. Shared Journal controller ownership, historical as-of Chart projections, observation context/response events, foreground test-walk cleanup and offline storage are integrated with the existing published edition, event sequence and asset authority. See the [final closure record](Project_Landfall_Phase_2_Final_Closure_Record.md) for correction qualification.

SQLite migration `202609300001_landfall_phase2_field_test_receipts` and MySQL migration `0068_landfall_phase2_field_test_receipts` add the owner-bound receipt table. SQLite fresh and upgrade histories are rehearsed against a disposable database; MySQL SQL parity is statically checked but a server migration is not claimed. Rollback requires retaining a backup before dropping the new receipt table; existing TaleDraft and published snapshots are not rewritten. Old Landfall-free and Phase 1 editions retain their prior schema shape because new waypoint and route presentation fields are optional.

The [validation record](Project_Landfall_Phase_2_Validation_Record.md) identifies exact checks and integration state. Phase 3 indoor positioning and Phase 4 Watchglass are outside this manifest.
