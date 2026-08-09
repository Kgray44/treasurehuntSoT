---
title: Project Deepwater Repository Index
audience: product-engineering
status: current
canonical_for: project-deepwater-repository-index
last_reviewed: 2026-08-09
---

# Project Deepwater

Project Deepwater is Voyagewright's capability-realization and systems-audit program. Phase 1 establishes the audit-only machine-readable inventory and control plane. Phase 2 traces the accepted priority queue, identifies exact loss points and root causes, and creates owner-assigned remediation packets without changing product behavior, schema, or data. Phase 3 reviews utilization across every governed capability, coordinates owner closure, and processes only independently mainline-safe remediation slices.

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

Phase 3 is active and explicitly authorized. All three registered documentation slices are accepted on protected main and close ten route-identity findings. The final control-plane candidate remains local until owner-project reconciliation, exact-source Sounding Line, protected integration, and actual-main proof complete. Phase 4 remains unauthorized.

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
