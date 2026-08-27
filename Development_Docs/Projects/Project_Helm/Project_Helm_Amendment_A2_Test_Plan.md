---
title: Project Helm Amendment A2 Test Plan
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a2-test-plan
last_reviewed: 2026-08-26
---

# Project Helm Amendment A2 test plan

## Acceptance journeys

| ID   | Journey                               | Required result                                                                                                                                                                        |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2-1 | Direct transfer                       | A joined successor receives Captain authority atomically; the prior Captain remains an unchanged Player; a receipt/audit is safe and durable.                                          |
| A2-2 | Relinquishment                        | The Captain enters Succession Hold without cancelling or advancing the shared Voyage.                                                                                                  |
| A2-3 | Succession recovery and takeover race | Refresh/reconnect restores the exact vacant candidate state and choices. Two eligible Players then contend for Captaincy; exactly one versioned claim commits and the loser refetches. |
| A2-4 | Continue Solo                         | One Player receives a new same-edition Voyage from the last committed shared state, with durable parent/child lineage and no parent mutation.                                          |
| A2-5 | Concurrent forks                      | Two Players can independently fork one committed source state; their children and lineage records remain separate.                                                                     |
| A2-6 | Privacy and authorization             | Foreign/revoked users, stale mutations, receipt probing, and non-allowlisted private content cannot change or disclose authority, forks, or Player data.                               |

## Required evidence

- Unit and route proof for authorization, CSRF, expected-version, idempotency, receipts, source lineage, progression hold, and private-state exclusion.
- Component/browser product proof for the Captain transfer/relinquish controls and the Player Succession Hold choices.
- A task-owned SQLite upgrade and fresh-schema rehearsal. The paired MySQL DDL is schema-validated and inspected; no production MySQL is implied.
- TypeScript, documentation, Feature Catalog, focused selected suite, and one candidate-bound Sounding Line authority run before protected integration.

## Non-goals

No test may use a real private Voyage, Creator draft, account session, or production database. A3 readiness, original Phase 3 command redesign, and Wakebook P3 are excluded.
