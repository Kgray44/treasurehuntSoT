---
title: Project Drydock engineering records
audience: engineering
status: current
canonical_for: project-drydock-engineering-records
last_reviewed: 2026-08-30
---

# Project Drydock engineering records

[Project Drydock](Project_Drydock_Governing_Document.pdf) governs the Chronicle authoring-contract, validation, compatibility, and later simulation program. Phase 1, Set the Blocks, is limited to typed authoring contracts, variables, expressions, schema evolution, compatibility fixtures, stable issues, and incremental contract validation. It does not implement whole-Chronicle analysis or simulation.

Phase 1 status: **MAINLINE ACCEPTED** through protected PR #22 at mainline merge `468530645e983412e5f4c1aaa103915be77c9c07`. Phase 2, **Sound the Hull**, is **MAINLINE ACCEPTED** through protected PR #36 at merge `847e035775984888be71edf614f2205fd6c5a376`. Phase 2 is limited to whole-Chronicle static analysis. Phase 3, **Run Sea Trials**, is **ACCEPTED MAINLINE** through protected PR #52 at merge `191a964488d0df71f8dcb91c5b8372fc73b6b32e`.

Phase 4, **Clear for Launch**, is **ACCEPTED MAINLINE** through protected PR
#198 at merge `29f3ae60cf13e79f79e6dd793c4cc94aca75b551`. It adds readiness,
compatibility, required Suite and publishing evidence, and migration parity
without replacing Drydock's validation/simulation or One Voyage's publication
authority.

## Phase 1 records

- [Design record](Project_Drydock_Phase_1_Set_the_Blocks_Design_Record.md)
- [Mainline Safety Contract](Project_Drydock_Phase_1_Mainline_Safety_Contract.md)
- [Current Story Block contract inventory](Project_Drydock_Phase_1_Current_Story_Block_Contract_Inventory.md)
- [Variable and expression contract record](Project_Drydock_Phase_1_Variable_and_Expression_Contract_Record.md)
- [Test plan](Project_Drydock_Phase_1_Test_Plan.md)
- [Validation record](Project_Drydock_Phase_1_Validation_Record.md)
- [Reconciliation report](Project_Drydock_Phase_1_Reconciliation_Report.md)
- [Integration manifest](Project_Drydock_Phase_1_Integration_Manifest.md)
- [Completion receipt](Project_Drydock_Phase_1_Completion_Receipt.md)
- `Project_Drydock_Phase_1_Block_Contract_Registry.json`
- `Project_Drydock_Phase_1_Migration_Catalog.json`
- `Project_Drydock_Phase_1_Historical_Compatibility_Ledger.json`
- `Project_Drydock_Phase_1_Provider_Registry.json`
- `Project_Drydock_Phase_1_Extension_Registry.json`
- `Project_Drydock_Phase_1_Active_Phase_Registration.json`

## Phase 3 records

Phase 3, **Run Sea Trials**, was accepted on protected main through PR #52.
Its scope is deterministic
Chronicle simulation, scenarios, virtual time, faults, coverage, and
One Voyage runtime-fidelity proof. It does not begin Phase 4 or change live
Voyage authority.

- [Active Phase Registration](Project_Drydock_Phase_3_Active_Phase_Registration.json)
- [Design Record](Project_Drydock_Phase_3_Design_Record.md)
- [Mainline Safety Contract](Project_Drydock_Phase_3_Mainline_Safety_Contract.md)
- [Migration Reservation](Project_Drydock_Phase_3_Migration_Reservation.json)
- [Scenario Contract](Project_Drydock_Phase_3_Scenario_Contract.md)
- [Fault Catalog](Project_Drydock_Phase_3_Fault_Catalog.json)
- [Runtime Fidelity Record](Project_Drydock_Phase_3_Runtime_Fidelity_Record.md)
- [Regression Scenario Ledger](Project_Drydock_Phase_3_Regression_Scenario_Ledger.json)
- [Test Plan](Project_Drydock_Phase_3_Test_Plan.md)
- [Browser Qualification Record](Project_Drydock_Phase_3_Browser_Qualification_Record.md)
- [Reconciliation Record](Project_Drydock_Phase_3_Reconciliation_Record.md)
- [Mainline Decision Failure Record](Project_Drydock_Phase_3_Mainline_Decision_Failure_Record.md)
- [Performance Record](Project_Drydock_Phase_3_Performance_Record.md)
- [Completion Receipt](Project_Drydock_Phase_3_Completion_Receipt.md)
- `Project_Drydock_Phase_3_Requirement_Ledger.json` — active implementation inventory; not a completion claim.

## Phase 2 records

- [Active Phase Registration](Project_Drydock_Phase_2_Active_Phase_Registration.json)
- [Rule Catalog](Project_Drydock_Phase_2_Rule_Catalog.json) — active implementation subset; not a completion claim.
- [Design Record](Project_Drydock_Phase_2_Design_Record.md)
- [Test Plan](Project_Drydock_Phase_2_Test_Plan.md)
- [Validation Record](Project_Drydock_Phase_2_Validation_Record.md)
- [Reconciliation Record](Project_Drydock_Phase_2_Reconciliation_Record.md)
- [Integration Manifest](Project_Drydock_Phase_2_Integration_Manifest.md)
- [Completion Receipt](Project_Drydock_Phase_2_Completion_Receipt.md)
- [Mainline Safety Contract](Project_Drydock_Phase_2_Mainline_Safety_Contract.md)
- [Migration Reservation](Project_Drydock_Phase_2_Migration_Reservation.json)
- [Synthetic Corpus Ledger](Project_Drydock_Phase_2_Synthetic_Corpus_Ledger.json) — active coverage ledger; not a completion claim.

## Phase 4 records

- [Design Record](Project_Drydock_Phase_4_Design_Record.md)
- [Mainline Safety Contract](Project_Drydock_Phase_4_Mainline_Safety_Contract.md)
- [Test Plan](Project_Drydock_Phase_4_Test_Plan.md)
- [Validation Record](Project_Drydock_Phase_4_Validation_Record.md)
- [Reconciliation Record](Project_Drydock_Phase_4_Reconciliation_Record.md)
- [Completion Receipt](Project_Drydock_Phase_4_Completion_Receipt.md)
