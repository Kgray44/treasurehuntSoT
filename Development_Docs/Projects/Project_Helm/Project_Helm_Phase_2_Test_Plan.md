---
title: Project Helm Phase 2 Test Plan
audience: product-engineering
status: current
canonical_for: project-helm-phase-2-test-plan
last_reviewed: 2026-08-10
---

# Project Helm Phase 2 test plan

## Scope

This plan covers the **Read the Deck** candidate only. It is not an acceptance
receipt and does not claim mainline status.

| Family                   | Required proof                                                                                          | Current implementation seam                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Projection contracts     | Status, severity, dedupe, stable priority, stale/unknown truthfulness                                   | `src/helm/operations.test.ts`                                |
| Member presence source   | fresh/recent/stale/unknown, sync/catch-up, multi-device aggregation and no fabricated member identity   | `src/platform/membership-presence.test.ts`                   |
| Presence authorization   | own-member scope, cross-voyage/forged membership denial, CSRF, device schema, future-sequence, rate cap | route and service presence tests                             |
| Presence lifecycle       | best-effort clean disconnect, membership-removal cleanup, restart/new-Voyage isolation                  | focused client/service and migration evidence                |
| Privacy                  | Deliberate private canaries absent from Library, Voyage, crew, progress, and events                     | allowlisted Helm DTO tests                                   |
| Authorization            | Captain, participating Captain, Player-only, other Voyage, revoked, altered id, direct event/crew reads | `api/captain/voyages/**` route tests                         |
| Source integrity         | Library/Voyage/crew/event reads do not change One Voyage business fingerprints                          | isolated SQLite service test                                 |
| Pagination               | descending canonical sequence/id, filters, stable cursor, no duplicates                                 | operations/service test                                      |
| Realtime/fallback        | polling reconciliation, stale display, reconnect and no duplicate events                                | focused Captain browser journey                              |
| Phase 1 regression       | Captain-only, Captain + Player, ordinary Player projection, artifact/history semantics                  | retained Helm Phase 1 family plus targeted Phase 2 extension |
| Responsive/accessibility | desktop/tablet/phone/200%/keyboard/reduced motion/Axe serious-critical zero                             | Helm browser family                                          |
| Performance              | bounded Library relation load, normal/large crew, event page baseline                                   | query-count/duration evidence                                |

## Failure handling

Failures are classified before repair under current Sounding Line policy. A
projection/privacy/authorization/source-integrity failure is a product defect;
locator and fixture faults remain test scope; missing runtime/setup and resource
contention remain environment/infrastructure scope. No failure authorizes
weakening Captain authority, Player safety, consent, or privacy.

## Candidate sequence

Run focused projection tests first, then isolated API/source-integrity tests,
then UI/browser and accessibility evidence. After current-main reconciliation,
use the smallest Sounding Line-authorized exact-candidate gate and protected
workflow. Preserve unaffected evidence under the adopted v1.1 invalidation
rules; do not run optional confidence passes after merge-authorizing evidence.
