---
title: Project Tideglass Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-1-validation
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 1 validation record

Status: the corrected Phase 1 foundation is integrated on main; the exact reconciled candidate and the actual integrated SHA both received source-bound `RELEASE_GO`.

## Evidence ledger

| Evidence                          | Result      | Boundary                                                                            |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Dedicated worktree preflight      | PASS        | Clean branch at exact `origin/main` base; concurrent worktrees untouched            |
| Prisma impact review              | PASS        | No schema or migration change in either provider                                    |
| Raw focused Vitest                | PASS, 49/49 | Diagnostic proof only; not a Sounding Line acceptance decision                      |
| TypeScript `tsc --noEmit`         | PASS        | Repository-wide static type proof after generating the locked Prisma client         |
| Sounding Line registry generation | PASS        | 1,747 cases total; 49 Tideglass cases in one owned read-only family                 |
| Sounding Line policy validation   | PASS        | Twelve owners, 49 suites, 416 contracts; zero policy errors                         |
| Pre-reconciliation candidate gate | RELEASE_GO  | Exact `7db576d0`; invalidated only by later accepted-main advancement               |
| Documentation validation          | PASS        | 865 engineering records indexed after Deepwater Phase 3 reconciliation              |
| Feature Catalog validation        | PASS        | 42 entries; `FT-B009` records the corrected mainline foundation                     |
| Current-main reconciliation       | PASS        | Merged and audited through `762258e3`; no Tideglass product-source overlap          |
| Reconciled candidate decision     | RELEASE_GO  | Exact `83ef66ff`; 30 clean receipts, plan `8e0e9b2b`, evidence `a9320157`           |
| Hosted protected checks           | PASS        | All 32 check runs and governed Mainline Decision passed for pull request #17        |
| Protected integration             | PASS        | Pull request #17 merged candidate `83ef66ff` as second parent of `40d822cd`         |
| Integrated-main decision          | RELEASE_GO  | Exact `40d822cd`; 30/30 clean receipts, plan `40cbf494`, evidence `6679da97`        |
| Remote parity                     | PASS        | `origin/main` exactly `40d822cd` at post-merge closure; candidate ancestry verified |
| Finalization reconciliation       | PASS        | Accepted Deepwater Phase 3 through `cf08ed09`; no Tideglass product-source overlap  |

## Focused behavior results

The corrected 49-case corpus passed every F01-F27 scenario. It also passed strict request/snapshot contracts, exact checksum binding, exact Chronicle/edition/schema identity binding, policy/schema binding, locale-independent ordering, explicit replacement with exact-ID target precedence, duplicate identity failure, missing-identity exclusion without index fallbacks, whole-schema unsupported suppression, explicit-null preservation, graph add/remove/rewire, reverse identity, redaction including withheld totals/categories, both-side authorization denial, client privilege escalation denial, bounded errors, cancellation, and no raw snapshot leakage.

The read-only fingerprint test preserved synthetic published snapshot bytes/checksums/relationships, live Voyage pin/progression/memberships/inventory/variables/events, Wayfarer history, and Harborlight release data exactly.

The large synthetic case used 500 blocks, map-based stable-ID matching, graph edges, 50 assets, 40 artifacts, and 40 locations. Its focused test completed in approximately 43 ms on the validation workstation, well inside the 5,000 ms design-review bound. This is local synthetic evidence, not a production budget or deployment claim.

## Historical governed receipts

Before the deterministic-contract corrections, Sounding Line returned `RELEASE_GO` for both a local subsystem run and the hosted synthetic merge candidate. Those decisions remain historical evidence for that exact source only. After correction and formatting, the exact candidate `7db576d00d89b65edb9a1a0225df130fff8fcbe5` received local mainline `RELEASE_GO` across 30 receipts with no missing, duplicate, unknown, or invalid evidence and all cleanup `CLEAN`. Its plan digest was `758cab09984cf16b74f2c622843fe81d5408deefb5924421076deab00bee906a`; its evidence digest was `f6bbe26d75451d5f80e3b20287c8a3c644324780b4c7b48fd7ed6288484559d1`. That decision was invalidated for final candidacy when accepted main advanced afterward; it remains exact historical evidence rather than acceptance of the reconciled branch.

The reconciled candidate `83ef66ff70a3bbeb85b90f6a99aeb8cfb0da8bf9` then received local mainline `RELEASE_GO` across 30 receipts with plan digest `8e0e9b2bdebd6f0156d2630715038885d2f627db8b5ba8bb27f3159298172a5e` and evidence digest `a93201574c771ee8bc0c5ecf0e6616b22489eed71b2e3477f5f21d1e5b97b509`. All 32 hosted check runs and the hosted governed Mainline Decision passed. The parent Actions workflow conclusion remained `failure` despite having no failed or non-success check run or job, so this record does not describe the wrapper itself as green.

After protected integration, exact main `40d822cd936c9abbfce064fd7799e6a2f8c9785e` received post-merge mainline `RELEASE_GO` across 30 receipts. Its plan digest was `40cbf494d38888a6c030148e3adc08a5dbf7e3f361b2a27af97fde03a5829958`; its evidence digest was `6679da979714844004e04912e5046396d57e06fc846871e80c56f201397bcabe`. Every receipt passed with cleanup `CLEAN`; missing, duplicate, unknown, and invalid evidence sets were empty. The access sentinel independently passed all three governed browser cases after the shared validation lane became available.

The reconciled policy validation passed with twelve owners, 49 suites, 416 contracts, zero policy errors, and policy digest `74fc1727a5f9065d7cdae83e24f4e6589e5ae8a298e3d52ad8b206da1feab3f3` after regenerating all 1,734 case definitions.

## Reconciliation record

The branch first reconciled accepted Deepwater Phase 1 through `273fb5255ad222812530422e902db04c0ddd1961`, then the project-governance wave through `5b266251bd5a42efe90988e45daf55bca8e566f1`. After the corrected candidate received `RELEASE_GO`, accepted Deepwater Phase 2 advanced main to `762258e31d7509aac8a7a46e7828ae0e92b84a84`. The new interval changed Deepwater records/tooling and shared Sounding Line policy, generated registry, documentation index/matrix, and generated Feature Catalog. It did not touch Tideglass product source, schemas, migrations, publication, authorization, or runtime behavior. The accepted Deepwater Phase 2 status was preserved; shared generated artifacts were rebuilt from the merged authoritative inputs; Tideglass retained 49 cases and its four contracts. Protected merge `40d822cd936c9abbfce064fd7799e6a2f8c9785e` has accepted main `762258e31d7509aac8a7a46e7828ae0e92b84a84` as its first parent and exact Tideglass candidate `83ef66ff70a3bbeb85b90f6a99aeb8cfb0da8bf9` as its second parent.

During final record publication, accepted Deepwater Phase 3 advanced main to `cf08ed0954e0bfd8279229604d3bec5c1beea4ae`. That interval added Deepwater utilization/control-plane source and changed the generated Feature Catalog, documentation index, migration matrix, and governed test inventory. It did not change Tideglass product source, its four contracts, schemas, migrations, authorization, or runtime behavior. The finalization branch merged the accepted mainline commit and regenerated shared outputs from both projects' authoritative source records. The reconciled result indexes 865 engineering records and 1,349 original documentation paths, registers 1,747 governed cases while retaining all 49 Tideglass cases, and passes policy validation with digest `f27089592a464a8afd29c730baa9117dcd7eedc7be83fa03a5cea8cbf75681f6`.

## Truth boundary

No ordinary user route, polished comparison surface, deployment, production database, private Chronicle, live Voyage, or owner acceptance is exercised. The CLI/service is implemented but has not been invoked against private content for this record. The accepted claim is limited to the exact integrated, additive, read-only Phase 1 foundation; Phase 2 remains outside scope.
