---
title: Project Deepwater Repository Index
audience: product-engineering
status: current
canonical_for: project-deepwater-repository-index
last_reviewed: 2026-08-09
---

# Project Deepwater

Project Deepwater is Voyagewright's capability-realization and systems-audit program. Phase 1 establishes an audit-only, machine-readable inventory and control plane. It does not remediate subsystem behavior or claim completion of later Deepwater phases.

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

Run `npm run deepwater:audit`, `npm run deepwater:validate`, and `npm run deepwater:report` to refresh and verify the Phase 1 control plane without mutating product or database state.
