---
title: Project Sounding Line Phase 3 Phase 2 Handoff Checklist
audience: engineering
status: current
---

# Phase 2 to Phase 3 handoff checklist

| Phase 2 interface or prerequisite                              | Observed mapping                                               | Classification                     |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| Plan/source/policy digests and selected-suite graph            | `validateSealedPlan`, `validateExecutionGraph`, Phase 1 CLI    | STABLE_PHASE3_INPUT                |
| Run marker, resource/lease, SQLite/browser/service isolation   | `runtime.mjs` marker/broker/clone/context/service APIs         | PROVISIONAL_RECONCILE_AFTER_PHASE2 |
| Allocation/setup/process/database/browser receipts             | phase-specific `writeReceipt`; no final uniform schema         | PROVISIONAL_RECONCILE_AFTER_PHASE2 |
| Scheduler inputs/outputs and suite identity                    | sealed plan graph; pilot handler map                           | PROVISIONAL_RECONCILE_AFTER_PHASE2 |
| Final suite/test-case result receipt and retry identity        | no product adapter/result schema                               | MISSING_REQUIRED_PHASE3_INPUT      |
| Environment/provider/fixture/build/generated artifact identity | partial runtime host only                                      | MISSING_REQUIRED_PHASE3_INPUT      |
| Timing/performance fields and failure signatures               | no governed historical store                                   | MISSING_REQUIRED_PHASE3_INPUT      |
| Durable controller/client/node journal and safe resume         | create/status/cleanup only; run/cancel refused                 | MISSING_REQUIRED_PHASE3_INPUT      |
| Cleanup receipt authority and orphan recovery                  | owned cleanup and inspection exist; no final receipt authority | PROVISIONAL_RECONCILE_AFTER_PHASE2 |
| Active product-suite adapters and accepted local mainline      | explicitly not validated / Phase 2 not accepted in main        | MISSING_REQUIRED_PHASE3_INPUT      |
| Product database Prisma schema                                 | deliberately outside Sounding Line store                       | NOT_RELEVANT                       |

Real Phase 3 may start only after Phase 2 is accepted in mainline, Harborlight is reconciled, stable receipts/adapters/timing extensibility/authoritative cleanup/no critical isolation debt exist, this package is reconciled, and a superseding implementation record is approved.

## Final-mainline classifications (superseding the initial survey)

| Final Phase 2 interface                                              | Accepted mapping                                                  | Classification              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| Source, policy, suite/resource contract, and plan digest             | `cli.mjs`, policy `1.1.0`                                         | STABLE_PHASE3_INPUT         |
| Graph, dependencies, deterministic scheduling, adapter outcome       | `validateExecutionGraph`, `executeGraph`, `executeProductAdapter` | STABLE_PHASE3_INPUT         |
| Marker, controller, runtime root, lease revision/state               | `runtime.mjs` marker/broker/receipts                              | STABLE_PHASE3_INPUT         |
| Process/server/browser/context/database/lane identity                | conjunctive process proof and run-owned resources                 | STABLE_PHASE3_INPUT         |
| Allowlisted array adapters and bounded log/exit evidence             | `adapters.mjs` and adapter receipt                                | STABLE_PHASE3_INPUT         |
| Cleanup/orphan/quarantine/full-release lock                          | marker-owned cleanup, ambiguous quarantine, emergency serial      | STABLE_PHASE3_INPUT         |
| Normalized phase and wall/resource-wait timing                       | event timestamps exist but no normalized timing contract          | ADDITIVE_EXTENSION_REQUIRED |
| Historical plan/node/attempt/test case/signature/performance records | new historical evidence store                                     | PHASE3_OWNED                |
| Client-independent controller, follow/resume, duplicate suppression  | beyond Phase 2 cleanup persistence                                | PHASE3_OWNED                |
| MySQL/provider and P34 full-matrix proof                             | configured external evidence and retained risk exception          | EXTERNAL_PENDING            |
| Distributed workers and Phase 4 passage proof                        | outside this preparation package                                  | LATER_PHASE                 |

No critical input remains vague or provisional. A future implementation branch must preserve active version-1 Phase 2 receipt semantics and add separately versioned Phase 3 records.
