---
title: Project Helm Phase 3 Test Plan
audience: product-engineering
status: current
canonical_for: project-helm-phase-3-test-plan
last_reviewed: 2026-08-27
---

# Project Helm Phase 3 test plan

## Scope

This plan qualifies the **Give the Orders** candidate. It is not an acceptance
receipt and does not claim protected-main, deployment, live-Voyage, external
provider, physical-device, or owner proof.

| Family                       | Required proof                                                                                       | Primary seam                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Command derivation           | Only current lifecycle/authority/verification/hint/rollback states expose commands                   | `src/helm/command-console.test.ts`                           |
| Safe map projection          | Published Passage identity/state only; optional, completed, current, and paused states are truthful  | `src/helm/command-console.test.ts`                           |
| Authorization and validation | Captain guard, CSRF, required confirmation/reason, contextual command and target rejection           | `api/captain/voyages/[voyageId]/commands` route tests        |
| Preview contract             | Fresh revision, current state, and published target are returned only for an allowed Captain command | preview route tests                                          |
| Conflict and retry           | Canonical expected sequence rejects a competing command; same idempotency key reconciles safely      | progression path plus isolated browser journey               |
| Privacy                      | Console and APIs exclude Creator/hidden/private canaries and raw data                                | DTO tests and isolated browser journey                       |
| Phase 2 regression           | Status, attention, event allowlist, crew presence/synchronization remain correct                     | `src/helm/operations.test.ts` and Captain voyage route tests |
| Product workflow             | Sign-in, create/launch synthetic Voyage, preview/confirm pause, resume state, stale response, retry  | `npm run helm:phase3:journeys`                               |
| Responsive/accessibility     | Keyboard focus, desktop/phone/effective-200-percent layout, serious/critical Axe zero                | `npm run helm:phase3:journeys`                               |
| Repository checks            | TypeScript, targeted lint/format, documentation, catalog validation                                  | repository scripts                                           |

## Fixture and failure rules

The browser journey creates a fresh SQLite database below the task-owned local
Project Helm directory, a synthetic account, Chronicle, and Voyage, and a
separate production build output. It never reads or writes the shared
development database or a normal account. Synthetic browser proof establishes
only the checked local product behavior.

A failed authorization, projection/privacy, idempotency, sequence, or
canonical-write test is a product defect. A disposable fixture/setup/build
failure is classified separately; it never authorizes weaker Captain authority,
unsafe Player disclosure, or a second command source. After current-main
reconciliation, the candidate requires the one ordinary exact-candidate
Sounding Line Mainline Decision before protected merge.
