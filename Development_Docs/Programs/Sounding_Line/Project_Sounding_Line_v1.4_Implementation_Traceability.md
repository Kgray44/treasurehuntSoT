---
title: Project Sounding Line v1.4 Implementation Traceability
audience: engineering
status: prompt-2-handoff
canonical_for: sounding-line-v14-implementation-handoff
last_reviewed: 2026-08-13
---

# Project Sounding Line v1.4 Implementation Traceability

This is the compact implementation handoff. It is subordinate to the v1.4 amendment and the ratified requirement traceability; it does not activate v1.4.

## Prompt 3 - Open the Fast Channel

| Requirement ID | Implementation owner/module                    | Existing foundation                 | Remaining code change                                                                                                                     | Required focused tests                      | Authority activation prompt | Dependencies                   |
| -------------- | ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------- | ------------------------------ |
| EP-001, RC-001 | `planner.mjs`, `finalizer.mjs`, evidence store | Shadow producer ledger              | Persist one producer per obligation and exhaustive release closure.                                                                       | duplicate/missing producer, release closure | Prompt 3                    | sealed plan/finalizer schema   |
| EP-002, SI-001 | new evidence lineage store                     | fingerprint/lineage helpers         | Persist immutable receipts, derivations, intervals and comparisons.                                                                       | lineage tamper/rebound                      | Prompt 3                    | fingerprint policy             |
| SI-002, IM-001 | planner + impact registry                      | shadow impact/ledger                | Compute changed contracts, all conditional dispositions and bounded fallback debt.                                                        | unknown/debt/conditional plans              | Prompt 3                    | contracts/impact map hardening |
| IM-002         | `release-gates.json`, policy schema            | caller-supplied floor               | Implement small sentinel/risk-floor registry for security, privacy, schema, identity, authorization, navigation, build and accessibility. | floor anti-omission                         | Prompt 3                    | suite/contract ownership       |
| RC-002         | planner + Prisma adapters                      | persistence fingerprint fields      | Escalate schema/migration/seed proof by dependency closure.                                                                               | schema/seed/migration mutations             | Prompt 3                    | Prisma/resources               |
| PL-001, SE-001 | prepared artifact registry/worker preparation  | typed shadow manifests              | Trusted layer publish/consume, content verification, revocation and attestation.                                                          | lock/schema/browser/tamper                  | Prompt 3                    | artifact transport decision    |
| PL-002, PB-002 | worker adapters/finalizer                      | cleanup validator                   | Seal actual mutable resource allocation and terminal disposition.                                                                         | survivor/wrong-owner/resource scope         | Prompt 3                    | resource broker                |
| TI-001, PB-001 | plan/envelope/binding                          | tree identity helper                | Carry candidate/base/predicted tree plus MSES into lightweight binding.                                                                   | missing identity/no heavy rerun             | Prompt 3                    | protected-binding interfaces   |
| SE-002, LE-002 | workflow and evidence policy                   | producer/scan fields; legacy helper | Enforce producer trust, scans, authority/suite compatibility.                                                                             | untrusted publish/legacy mismatch           | Prompt 3                    | workflow permissions           |
| FR-001         | planner/finalizer policy                       | shadow reason codes                 | Persist typed failure dispositions and recovery routes.                                                                                   | stale/corrupt/fallback                      | Prompt 3                    | evidence store                 |
| LE-001         | legacy adoption importer                       | reconstruction helper               | Build v1.3-to-v1.4 adoption records and narrow reruns.                                                                                    | complete/incomplete legacy fixtures         | Prompt 3                    | receipt archive                |
| SH-001         | worker/artifact abstraction                    | transport-neutral manifest          | Define hosted/self-hosted-neutral layer interface.                                                                                        | equivalent manifest/receipt fixtures        | Prompt 3                    | artifact registry              |

Prepared-layer transport decision criteria are artifact size/compression, restore bandwidth, hit rate, native extraction overhead, verification time, quota/eviction, cross-OS portability and producer/consumer trust. The Prompt 1 benchmark remains only local identity/restore feasibility proof.

## Prompt 4 - Run the Mainline Train

| Requirement ID        | Implementation owner/module         | Existing foundation                          | Remaining code change                                                                                           | Required focused tests             | Authority activation prompt | Dependencies                 |
| --------------------- | ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------- | ---------------------------- |
| TI-002, MT-001        | train planner and protected binding | deterministic local synthetic-tree prototype | Persist ordered cars, governed merge-strategy identity and predicted tree proofs; compare physical landed tree. | repeat tree/match-mismatch         | Prompt 4                    | Prompt 3 tree-bound evidence |
| MT-002                | train controller                    | withdrawal suffix helper                     | State machine, mutation/withdrawal/head failure/external-main brakes and earliest affected replan.              | each replan boundary               | Prompt 4                    | persisted car identities     |
| TRAIN-08/09/10 detail | migration/authority adapters        | conflict-return prototype                    | Governed conflict ownership, migration collision and policy-drift blockers.                                     | conflict/migration/policy fixtures | Prompt 4                    | schema dependency graph      |
| TRAIN-11/12 detail    | scheduler policy                    | none                                         | Fairness aging, audited emergency preemption and record-only lane.                                              | starvation/preemption simulations  | Prompt 4                    | admission policy             |
| FR-001 train detail   | train controller                    | typed reason seam                            | Attach exact brake scope to failed/revoked evidence.                                                            | revocation/tree mismatch           | Prompt 4                    | artifact revocation          |

## Prompt 5 - Cut Over Authority

| Requirement ID         | Implementation owner/module | Existing foundation                 | Remaining code change                                                                                       | Required focused tests       | Authority activation prompt | Dependencies                     |
| ---------------------- | --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------- | -------------------------------- |
| FR-002, SM-001, SM-002 | shadow runner/reporting     | nonauthoritative comparison         | Representative/adversarial dual decisions and controlled metrics.                                           | required shadow corpus       | Prompt 5                    | Prompts 3-4 complete             |
| AC-001, AC-002         | authority index/PR workflow | strict shadow boundary              | Freeze candidate, final current-authority broad acceptance, single protected merge and atomic index switch. | mixed-version/cutover stops  | Prompt 5                    | qualified v1.4 implementation    |
| RB-001                 | emergency policy            | none                                | Demonstrate governed serial/current-base fallback and receipt compatibility refusal.                        | rollback drill               | Prompt 5                    | authority index                  |
| PF-001                 | telemetry/reporting         | Prompt 0 baseline + local benchmark | Measure queue/setup/restore/execution/teardown/binding/train against equivalent corpus.                     | performance report integrity | Prompt 5                    | hosted evidence                  |
| SH-002                 | self-hosted trust adapter   | portable manifest seam              | Verify boot attestation, scrub, ownership and stale-state/tamper denial.                                    | self-hosted negatives        | Prompt 5                    | approved self-hosted environment |

Prompt 5 is the only activation prompt. It must retain one protected check, preserve current authority until accepted, perform one atomic merge, then self-verify actual integrated main. Option C is compatible but not implemented by Prompt 2.
