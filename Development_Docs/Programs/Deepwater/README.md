---
title: Project Deepwater Repository Index
audience: product-engineering
status: current
canonical_for: project-deepwater-repository-index
last_reviewed: 2026-08-12
---

# Project Deepwater

Project Deepwater is Voyagewright's capability-realization and systems-audit program. Phase 1 establishes the audit-only machine-readable inventory and control plane. Phase 2 traces the accepted priority queue, identifies exact loss points and root causes, and creates owner-assigned remediation packets without changing product behavior, schema, or data. Phase 3 reviews utilization across every governed capability, coordinates owner closure, and processes only independently mainline-safe remediation slices. Phase 4, Break the Surface, turns the accepted inventory into a source-current whole-product proof population while preserving explicit owner, provider, deployment, and protected-main boundaries.

## Current Phase 4 records

- [Design record](phase-records/Project_Deepwater_Phase_4_Design_Record.md)
- [Validation record](phase-records/Project_Deepwater_Phase_4_Validation_Record.md)
- `deepwater-phase4-config.json`
- `evidence/phase4/Project_Deepwater_Phase_4_Runtime_Evidence.json`
- [Proof report](reports/Project_Deepwater_Phase_4_Proof_Report.md)
- `reports/Project_Deepwater_Phase_4_Capability_Proof_Matrix.json`
- `reports/Project_Deepwater_Phase_4_State_Recovery_Matrix.json`
- [Visual and accessibility report](reports/Project_Deepwater_Phase_4_Visual_Accessibility_Report.md)
- [Owner walkthrough packet](reports/Project_Deepwater_Phase_4_Owner_Walkthrough_Packet.md)
- [Phase 3 to Phase 4 delta report](reports/Project_Deepwater_Phase_3_to_Phase_4_Delta_Report.md)
- `reports/Project_Deepwater_Phase_4_Proof_Queue.json`
- `reports/Project_Deepwater_Phase_5_Governance_Queue.json`

Phase 4 is reconciled to protected `origin/main` at `cbf634d4d5db9cf47edebb89e005e8cc910068bd` after Wakebook Phase 1 protected-merged PR #41. Wakebook’s accepted Chronicle history consumers and Sounding Line registry updates add no Phase 4 capability or Feature Catalog denominator entry, but supersede r8. Renewed focused and affected-subsystem proof now passes on rebased source `054bd19b7da4f57cd8be0b39758a3cc03e43c3aa`: 26 direct Player/Captain/stream tests, governed `browser.helm` 3/3 with clean conformance, Deepwater 66/66, Drydock 196/196 plus migration rehearsal, Admiralty 34 direct tests/15-route validator/migrations, and Bridgewatch typecheck/24 tests/build. One r9 Phase 4 candidate is frozen from this reconciled base and awaits serialized Mainline Decision ownership. Two earlier hosted Mainline Decisions failed closed as `EVIDENCE_INVALID`, both solely on `browser.helm`; their finalizers cleaned up and those candidates are historical only. The underlying product repair retains Helm route recovery, canceled Player event-stream detachment, and visibility-safe waiting-room recovery. It accounts for accepted FT-036 Drydock Creator Studio Sea Trials and the accepted Admiralty surface without reopening either owner implementation or closure record. FT-036's catalog fragment remains `BRANCH_COMPLETE_NOT_MERGED` pending its separate owner-controlled record promotion. Homeport evidence remains explicitly carried from `b810e2d0c33cbafb8e4d02c19b9af0db94315783`. Homeport owner re-review remains `PENDING_OWNER_DECISION`; local proof neither records owner or product acceptance nor substitutes for a canonical hosted Mainline Decision. Phase 5 remains unauthorized.

## Current Phase 3 records

- [Design record](phase-records/Project_Deepwater_Phase_3_Design_Record.md)
- [Validation record](phase-records/Project_Deepwater_Phase_3_Validation_Record.md)
- [Integration record](phase-records/Project_Deepwater_Phase_3_Integration_Record.md)
- `deepwater-phase3-config.json`
- `utilization/deepwater-capability-utilization.json`
- `utilization/deepwater-capability-utilization.schema.json`
- `remediation/deepwater-phase3-slices.json`
- `remediation/deepwater-phase3-slices.schema.json`
- `evidence/Project_Deepwater_Phase_3_Evidence_Index.json`
- [Utilization report](reports/Project_Deepwater_Phase_3_Utilization_Report.md)
- [Remediation report](reports/Project_Deepwater_Phase_3_Remediation_Report.md)
- [Phase 2 to Phase 3 delta report](reports/Project_Deepwater_Phase_2_to_Phase_3_Delta_Report.md)
- [Final report](reports/Project_Deepwater_Phase_3_Final_Report.md)
- `reports/Project_Deepwater_Phase_3_Realization_Queue.json`
- `reports/Project_Deepwater_Phase_4_Proof_Queue.json`

Phase 3 is complete and accepted on protected main through PR #33 as `ca135585a62f445cd4331df1a7dd21203bd50219`. All three registered documentation slices close ten route-identity findings; accepted Helm owner evidence closes FT-007 as the eleventh documentation reconciliation. The exact candidate, hosted matrix, and actual-main SHA all received source-bound `RELEASE_GO` proof. Six catalog findings remain explicitly open, including the Tideglass semantic-consumer and Admiralty transactional-email health boundaries. Phase 4 is separately authorized from a fresh current-main base; Phase 3 history remains immutable.

## Current Phase 2 records

- [Design record](phase-records/Project_Deepwater_Phase_2_Design_Record.md)
- [Validation record](phase-records/Project_Deepwater_Phase_2_Validation_Record.md)
- [Integration record](phase-records/Project_Deepwater_Phase_2_Integration_Record.md)
- `deepwater-phase2-config.json`
- `traces/capability-traces.json`
- `traces/capability-traces.schema.json`
- `remediation/deepwater-remediation-packages.json`
- `remediation/deepwater-remediation-packages.schema.json`
- `evidence/Project_Deepwater_Phase_2_Evidence_Index.json`
- [Trace report](reports/Project_Deepwater_Phase_2_Trace_Report.md)
- [Root-cause summary](reports/Project_Deepwater_Phase_2_Root_Cause_Summary.md)
- [Assignment summary](reports/Project_Deepwater_Phase_2_Assignment_Summary.md)
- [Phase 1-to-Phase 2 delta report](reports/Project_Deepwater_Phase_1_to_Phase_2_Delta_Report.md)
- `reports/Project_Deepwater_Phase_2_Feature_Catalog_Reconciliation.json`
- `reports/Project_Deepwater_Phase_2_Active_Project_Coordination_Register.json`
- `reports/Project_Deepwater_Phase_3_Realization_Queue.json`

The Phase 2 implementation is accepted on main through protected PR #19. Its trace, remediation, evidence, and reports remain historical source-bound records and are not regenerated from mutable Phase 3 catalog fragments.

## Current Phase 1 records

- [Design record](phase-records/Project_Deepwater_Phase_1_Design_Record.md)
- `capability-realization-ledger.json`
- `capability-realization-ledger.schema.json`
- `deepwater-ownership-map.json`
- `deepwater-findings.json`
- `deepwater-audit-config.json`
- `deepwater-phase-status.json`
- [Audit report](reports/Project_Deepwater_Phase_1_Audit_Report.md)
- [Capability summary](reports/Project_Deepwater_Phase_1_Capability_Summary.md)
- `reports/Project_Deepwater_Phase_2_Trace_Queue.json`
- [Validation record](phase-records/Project_Deepwater_Phase_1_Validation_Record.md)
- [Integration record](phase-records/Project_Deepwater_Phase_1_Integration_Record.md)

Run `npm run deepwater:audit`, `npm run deepwater:validate`, and `npm run deepwater:report` to refresh and verify the accepted control plane without mutating product or database state.
