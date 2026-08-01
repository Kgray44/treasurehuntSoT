---
title: Project Homeport Repository Index
audience: product-engineering
status: current
canonical_for: project-homeport-repository-index
last_reviewed: 2026-08-01
---

# Project Homeport

Project Homeport is the governed product-reality recovery and convergence program. Phase 0 preserves the historical current-state census. Phase 1 implements identity and session convergence without beginning Phase 2 shell/navigation reconstruction.

## Authority

- [Project Homeport Governing Document](Project_Homeport_Governing_Document.md) — searchable normative transcription.
- [Project Homeport Governing Document PDF](Project_Homeport_Governing_Document.pdf) — supplied 102-page layout authority.
- [Voyagewright Global Product Governance Standard](../../Governance/Voyagewright_Global_Product_Governance_Standard.md) — global governing authority.

## Phase 0 human records

- [Phase 0 Audit Report](Project_Homeport_Phase_0_Audit_Report.md)
- [Design Record](Project_Homeport_Design_Record.md)
- [Natural-Journey Audit](Homeport_Journey_Audit.md)
- [Curated Evidence](evidence/phase0/README.md)

## Phase 1 human records

- [Identity and Session Architecture](Project_Homeport_Phase_1_Identity_and_Session_Architecture.md)
- [Test Plan](Project_Homeport_Phase_1_Test_Plan.md)
- [Implementation Report](Project_Homeport_Phase_1_Implementation_Report.md)
- [Validation Record](Project_Homeport_Phase_1_Validation_Record.md)
- [Integration Manifest](Project_Homeport_Phase_1_Integration_Manifest.md)
- [Curated Evidence](evidence/phase1/README.md)

## Phase 2 architecture

- [Global Shell and Wayfinding Architecture](Project_Homeport_Phase_2_Global_Shell_and_Wayfinding_Architecture.md)

Implementation, validation, integration, and evidence records are added only
after the frozen architecture is implemented and governed verification is run.

## Phase 0 machine-readable records

- `Homeport_Route_Inventory.json`
- `Homeport_Authentication_and_Session_Inventory.json`
- `Homeport_Navigation_Map.json`
- `Homeport_Screen_Catalog.json`
- `Homeport_Screen_Contract_Catalog.json`
- `Homeport_Control_Inventory.csv`
- `Homeport_Journey_Catalog.json`
- `Homeport_Visual_Baseline_Manifest.json`
- `Homeport_Nonconformity_Ledger.csv`

These records retain Phase 0 observations and now add explicit Phase 1 implemented-state fields, A-Q journey records, and after-state evidence. The Phase 1 compatibility authority is `Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv`.

Run `npm run homeport:validate` to validate artifact structure, cross-references, source paths, compatibility status, committed evidence, and screenshot checksums. `PRODUCT_NONCONFORMITIES_PRESENT` remains expected because later-phase findings remain open; it is not a validator failure.
