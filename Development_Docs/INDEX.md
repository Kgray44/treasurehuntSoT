---
title: Engineering record index
audience: engineering
status: current
canonical_for: engineering-record-index
last_reviewed: 2026-08-19
---

# Engineering-record index

- `Governing/`: accepted policies and foundational specifications.
- `Governance/`: current repository-wide governance standards and their source records.
- `Projects/`: current project governing documents and project-specific records.
- `Architecture_Decisions/`: durable technical decisions.
- `Projects/`: governed project and phase records, including design, validation,
  integration, and completion evidence.
- `Programs/`: project records grouped by program.
- `Validation/`: test plans, ledgers, audits, and validation evidence.
- `Migrations/`: migration, rollback, and compatibility records.
- `Completion_Receipts/`: historical implementation receipts.
- `Project_Bridgewatch_Phase_2_*.md`: current Phase 2 design, registry,
  qualification, validation, integration, and closure records.
- `Project_Bridgewatch_Phase_3_*.md`: Phase 3 history, retention, archive,
  branch-health, validation, performance, deployment, integration, and
  closure records.
- `Project_Bridgewatch_Completion_Receipt.md`: final program receipt; it is
  authoritative only after protected-main acceptance is recorded.
- `Project_Bridgewatch_v1.2_*.md`: post-completion Mission Control amendment
  design, data-fidelity audit, local validation, and protected-integration
  receipt; this is a version increment, not Phase 4.
- `Archive/`: superseded, prompt, and legacy material.

Use [document-index.json](document-index.json) for complete path-level classification.

## Project Admiralty

- [Project Admiralty governing baseline v1.2](Projects/Project%20Admiralty/Project_Admiralty_Platform_Administration_and_Operations_Governing_Document_v1.2.pdf) remains the parent administrative authority.
- [Project Admiralty Governing Amendment v1.3 - The Support Pilot](Projects/Project%20Admiralty/Project_Admiralty_Governing_Amendment_v1.3_The_Support_Pilot.md) governs autonomous support diagnosis, delegated execution grants, bounded registered repairs, postcondition verification, support receipts, and systemic defect handoff. It supplements v1.2 and defines the S1 `Open the Case`, S2 `Turn the Wrench`, and S3 `Close the Case` sequence after accepted Admiralty Phase 3.

## Project Trim

- [Project Trim governing baseline v1.0-R1](Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf) is the current Project Trim governing baseline. Phase 0 records under `Programs/Project_Trim/` are preserved program evidence, not governing authority.

## Project Fairlead

- [Project Fairlead governing baseline v1.0](Governing/Project_Fairlead_GitHub_Interaction_and_Quota_Control_Plane_Governing_Document_v1.0.md) defines the repository-wide GitHub interaction and quota control plane: Git-first routing, REST/GraphQL selection, shared rate-state coordination, conditional caching, request coalescing, adaptive polling, GitHub App authentication, Bridgewatch and Sounding Line integration, degraded-operation behavior, and permanent automation governance.

## Project Sounding Line amendments

The Version 1.3 Amendment Edition is the newest Sounding Line amendment. It
supplements the preserved Version 1.0 base documents and Version 1.1 and Version
1.2 amendments; it does not replace them.

- [Part I - Software Verification Architecture, v1.2](Governing/Project_Sounding_Line_Part_I_Governing_Document_v1.2_Amendment_Edition.pdf)
- [Part II - Execution Infrastructure and Parallel Runtime, v1.2](Governing/Project_Sounding_Line_Part_II_Governing_Document_v1.2_Amendment_Edition.pdf)
- [Part III - Repository Policy, Codex Governance, and Release Assurance, v1.2](Governing/Project_Sounding_Line_Part_III_Governing_Document_v1.2_Amendment_Edition.pdf)
- [Part III - Repository Policy, Codex Governance, and Release Assurance, v1.3](Governing/Project_Sounding_Line_Part_III_Governing_Document_v1.3_Amendment_Edition.pdf)
- [Effective Sounding Line authority](Governing/Sounding_Line_Effective_Authority.md) - human-readable projection of the canonical `testing/sounding-line-authority.json` source.
- [v1.4 Performance & Efficiency Governing Addendum](Governing/Project_Sounding_Line_v1.4_Performance_and_Efficiency_Governing_Addendum.md) - draft performance non-regression rules and final-calibration template; it does not independently change machine-readable authority.
- [v1.4 Bridgewatch ordinary-candidate classification repair plan](Programs/Sounding_Line/Sounding_Line_v1.4_Bridgewatch_Ordinary_Candidate_Classification_Repair_Plan.md) - bounded authority-change repair for the standalone Bridgewatch workspace and its fixed integration seams.
- [v1.4 bounded mixed-browser batching repair plan](Programs/Sounding_Line/Sounding_Line_v1.4_Bounded_Mixed_Browser_Batching_Repair_Plan.md) - bounded authority-maintenance repair for sealed browser-case physical partitions and exact logical receipt closure.
