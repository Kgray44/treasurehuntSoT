---
title: Project Landfall Phase 1 Threat Model
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-threat-model
last_reviewed: 2026-09-29
---

# Phase 1 Threat Model

## Protected assets and boundaries

Private physical coordinates, hidden waypoint geometry, player journey state, draft definitions, and canonical progression are protected assets. Creator-authored Landfall JSON and browser/device observations are untrusted inputs. A provider ID identifies an application capability, not a cryptographic proof of presence. The One Voyage event transaction remains the only progression authority.

| Threat                                                       | Phase 1 control                                                                                                                                                                       | Residual boundary                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Malformed or cross-Worldspace authored data                  | Strict versioned Zod schema, reference and bounds checks, geometry validation, size cap                                                                                               | Asset ownership/delivery must be checked by a later authoring workflow before exposure               |
| Spoofed, stale, duplicate, or impossible physical fixes      | Session/version/source checks, age/order/duplicate and speed checks, accuracy and repeated evidence, dwell, provider availability                                                     | Browser geolocation is advisory; no client claim alone grants One Voyage progress                    |
| Virtual source claiming a false location                     | Source capability, target, bounds, confidence and corroboration checks                                                                                                                | Future game/Watchglass adapters need their own trust policy                                          |
| Private coordinates or journey state in logs or public Chart | Raw fixes stay bounded in memory; diagnostics and receipts omit coordinates; public projection omits exact position, visits, journey, and hidden discoveries; public map fails closed | Callers must not log raw provider callbacks or expose Creator-test projections without authorization |
| Captain surveillance                                         | Exact Captain position requires session-scoped, time-limited live consent; no durable trail                                                                                           | Consent issuing and revocation UI belong to a later phase; Phase 1 grants no Captain endpoint        |
| Hidden route or waypoint leakage                             | Runtime filters hidden targets until canonical reveal; map derives from filtered Chart                                                                                                | A Creator draft or published snapshot must only be delivered behind its existing role authorization  |
| Replayed/offline evidence becoming canonical                 | Local and queued states remain distinct; reconciliation checks session, edition, evidence, target, sequence, and canonical event ID; duplicate receipt is idempotent                  | One Voyage must verify and write the event transaction before issuing a receipt                      |
| Untrusted map style execution or network access              | Authoring data names a provider/style ID; renderer accepts trusted application style code only and has a text fallback                                                                | Application-supplied map providers still need ordinary dependency, tile, CSP and attribution review  |

No real private story content, raw travel log, persistent GPS trace, background listener, or location telemetry table is introduced by Phase 1.
