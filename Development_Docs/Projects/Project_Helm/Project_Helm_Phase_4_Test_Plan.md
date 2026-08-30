---
title: Project Helm Phase 4 Test Plan
audience: product-engineering
status: accepted-mainline
canonical_for: project-helm-phase-4-test-plan
last_reviewed: 2026-08-28
---

# Project Helm Phase 4 test plan

This plan qualifies the **Weather the Passage** candidate. It is not a
protected-main, deployment, live-Voyage, external-provider, physical-device,
or owner-walkthrough acceptance receipt.

| Family             | Required proof                                                                                                                                     | Primary seam                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Preflight truth    | Canonical edition, Crew, and lifecycle facts block launch readiness; absent provider contracts remain unknown                                      | `src/helm/passage-resilience.test.ts`                         |
| Degraded operation | Warning-level connection/system conditions project degraded without mutating canonical lifecycle                                                   | `src/helm/operations.test.ts`                                 |
| Recovery authority | Only existing pause, resume, replay, and restore commands are offered; unsupported repair is escalation                                            | `src/helm/passage-resilience.test.ts` and command route tests |
| Evidence/privacy   | Recovery carries only observation time and source sequence; no provider secret, device identifier, Creator, or Player-private payload is projected | DTO and browser checks                                        |
| Regression         | Existing P1-P3 authority, command confirmation, idempotency, CSRF, and stale-sequence behavior remain enforced                                     | focused Helm tests and ordinary Sounding Line decision        |

The candidate uses a task-owned synthetic fixture for browser qualification.
It must not substitute a local fixture, a copied database, or a browser visual
check for the one exact-candidate ordinary Sounding Line decision required
before a protected merge.
