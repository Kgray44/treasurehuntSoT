---
title: Project Helm Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-helm-phase-1-integration-manifest
last_reviewed: 2026-08-09
---

# Project Helm Phase 1 integration manifest

## Evidence boundary

This manifest records the required current-main reconciliation for **Take the
Helm**. Until the protected integration and post-merge checks are complete, it
is a pre-integration record and does not claim mainline acceptance.

| Field                  | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Original base SHA      | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                           |
| Current `origin/main`  | `40d822cd936c9abbfce064fd7799e6a2f8c9785e`                           |
| Branch                 | `codex/project-helm-phase1-take-the-helm`                            |
| Owned worktree         | `C:\Users\kkids\Documents\treasurehuntSoT-helm-phase1-take-the-helm` |
| Candidate commit       | `fed088f91cc5cabc0d2a65dd2f9d8c3f7628ca55` reconciled checkpoint     |
| Protected integration  | Pending                                                              |
| Final reconciled main  | Pending                                                              |
| Current mainline state | `RECONCILED_VALIDATION_IN_PROGRESS`                                  |

## Intervening commits reviewed

| Commit                          | Classification                                  | Review result                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c9cb4e5`                       | Adjacent and direct shared-governance overlap   | Adds the Deepwater audit control plane and its Sounding Line owner, suite, contract, registry rules, gates, and package scripts. No Helm product source changed.                                                     |
| `ef51137`                       | Adjacent generated-document overlap             | Adds Deepwater records and refreshes the generated Feature Catalog and documentation index. No Helm product source changed.                                                                                          |
| `d3b04e5`                       | Integration commit                              | Protected merge of Deepwater Phase 1 candidate through pull request 15.                                                                                                                                              |
| `a57fe26`                       | Adjacent generated-document overlap             | Finalizes Deepwater Phase 1 records and generated documentation outputs. No Helm product source changed.                                                                                                             |
| `273fb52`                       | Integration commit                              | Protected merge of Deepwater finalization through pull request 16.                                                                                                                                                   |
| `b1d4d8f`                       | Direct governing-document and generated overlap | Adds the 2026 project-wave governing PDFs, including Helm and the continuous-development standard, and refreshes documentation generators, the index, and generated Feature Catalog. No Helm product source changed. |
| `5b26625`                       | Integration commit                              | Protected merge of the governance bootstrap through pull request 18.                                                                                                                                                 |
| `458a1d3`                       | Direct shared-governance overlap                | Adds Deepwater Phase 2 trace control-plane records and extends the shared Sounding Line registry and policy metadata. No Helm product source changed.                                                                |
| `6cfd8e4`                       | Adjacent generated-document overlap             | Records Deepwater Phase 2 candidate validation and refreshes generated Feature Catalog and documentation outputs. No Helm product source changed.                                                                    |
| `28a3139`                       | Integration commit                              | Protected merge of Deepwater Phase 2 through pull request 19.                                                                                                                                                        |
| `35b1418`                       | Adjacent product implementation                 | Adds Tideglass's read-only semantic edition-comparison authority, services, tests, and CLI. No Helm product source changed.                                                                                          |
| `986efb9`                       | Adjacent generated-document overlap             | Catalogs the Tideglass branch capability. Its machine-readable fragment and generated catalog output were retained alongside Helm's separate Captain fragment.                                                       |
| `fd16f35`                       | Adjacent integration records                    | Records Tideglass's current-main reconciliation without changing Helm product source.                                                                                                                                |
| `6991c91`, `c446922`, `e8efe2a` | Integration reconciliation                      | Reconcile Tideglass with then-current main and Deepwater records. Helm retains its own product implementation and branch-owned records.                                                                              |
| `1366095`, `a1627ee`, `7db576d` | Adjacent correction set                         | Tightens Tideglass determinism, updates its candidate records, and formats the correction set. No Helm product source changed.                                                                                       |
| `1068da6`, `762258e`            | Adjacent Deepwater closure                      | Finalizes and accepts Deepwater Phase 2 integration records and generated documentation. No Helm product source changed.                                                                                             |
| `83ef66f`                       | Integration reconciliation                      | Reconciles the Tideglass candidate with accepted Deepwater closure.                                                                                                                                                  |
| `40d822c`                       | Integration commit                              | Protected merge of Project Tideglass Phase 1 into main.                                                                                                                                                              |

The governance bootstrap introduces the supplied Project Helm and continuous
development PDFs as tracked governing authorities. Their Git blob identities
match the authorities reviewed for this phase.

## Overlap classification

| Area                                             | Classification                   | Reconciliation rule                                                                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helm product source and tests                    | None                             | Retain Helm implementation and focused functional findings.                                                                                                                                                           |
| Sounding Line registry generator and policy JSON | Direct shared-governance overlap | Merged semantically. Preserved Deepwater and Tideglass ownership plus the dedicated Helm unit, component, browser, contract, owner, impact, and gate entries; regenerated the active registry from reconciled source. |
| `package.json`                                   | Direct shared-governance overlap | Preserve Deepwater and Tideglass commands and the existing repository scripts; Helm adds no package command.                                                                                                          |
| Documentation validation and index generator     | Adjacent                         | Accept current-main generator behavior, then regenerate the documentation index and migration matrix with Helm records present.                                                                                       |
| Feature Catalog and documentation index outputs  | Generated overlap                | Preserve machine-readable fragment ownership, run the generators, and never choose either generated side manually.                                                                                                    |
| Prisma schemas and migrations                    | None                             | No schema merge, migration, backfill, or database rewrite.                                                                                                                                                            |

## Evidence invalidation and retention

The mainline advance does not invalidate the behavioral diagnosis already
obtained from Helm's focused unit, component, route, artifact, history, or
browser journeys because it changes no product source they exercise. Those
results remain useful diagnostic evidence only.

The advance **does** invalidate every acceptance claim tied to the earlier
Sounding Line policy digest, generated test inventory, generated documentation
index, or generated Feature Catalog. After semantic reconciliation, Helm must:

1. regenerate and validate the full Sounding Line policy and active registry;
2. rerun focused Helm contracts where the new registry selects them;
3. run the authoritative current-main Sounding Line gate on the exact candidate;
4. regenerate and validate documentation and the Feature Catalog; and
5. prove the integrated candidate is an ancestor of advertised `origin/main`
   with required path parity and no task-owned runtime residue.

No branch-local receipt, local browser run, or this manifest substitutes for
the protected integration and post-merge evidence.
