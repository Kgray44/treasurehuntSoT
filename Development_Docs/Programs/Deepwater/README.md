---
title: Project Deepwater Repository Index
audience: product-engineering
status: current
canonical_for: project-deepwater-repository-index
last_reviewed: 2026-08-09
---

# Project Deepwater

Project Deepwater is Voyagewright's capability-realization and systems-audit program. Phase 1 establishes the audit-only machine-readable inventory and control plane. Phase 2 traces the accepted priority queue, identifies exact loss points and root causes, and creates owner-assigned remediation packets without changing product behavior, schema, or data.

## Current Phase 2 records

- [Design record](phase-records/Project_Deepwater_Phase_2_Design_Record.md)
- [Validation record](phase-records/Project_Deepwater_Phase_2_Validation_Record.md)
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

The Phase 2 integration record is added only when protected-mainline convergence completes. The Phase 3 queue is planning input only; Phase 3 remediation is not authorized or active in this worktree.

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
