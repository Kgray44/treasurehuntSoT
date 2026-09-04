---
title: Voyagewright Brightwork Evidence
audience: engineering-evidence
status: current
canonical_for: voyagewright-brightwork-stage-1-evidence
last_reviewed: 2026-09-03
---

# Voyagewright Brightwork Evidence

This directory holds the current-main Brightwork capture inventory and evidence mechanics. It intentionally records product reality without judging or repairing it.

- `Current_Route_Census.json` is the source-route and classification census.
- `Current_Screen_Census.json` is the corresponding screen census.
- `Visual_Capture_Contract.json` defines required visual evidence identities.
- `Visual_Evidence_Coverage_Report.json` and `Visual_Evidence_Freshness_Report.json` provide fail-closed reconciliation results.
- `Capture_Limitations_and_Blockers.md` records only capture limitations and product blockers.
- `Brightwork_Stage_1_Completion_Record.md` is written after final validation.
- `Brightwork_Stage_4B_Evidence_Addendum.md` records the evidence-only Stage 4B reconciliation, without creating the master findings ledger.
- `Voyagewright_Brightwork_Stage_6_Creator_Live_Continuation_Findings.md` records the diagnosis-only Creator, Studio, and Drydock live-audit continuation and its final Stage 7 source disposition; it does not independently authorize a repair.
- `Voyagewright_Brightwork_Stage_7_Master_Audit_Reconciliation.md` is the canonical, frozen Stage 7 reconciliation and repair-authority ledger. It adjudicates every Creator continuation observation and preserves the reference-quality contracts.
- `Voyagewright_Brightwork_Stage_8_Wave_0_Completion_Record.md` records the completed evidence-safety wave. It does not authorize or begin Wave 1 product repair.
- `Brightwork_Meaningful_State_Coverage_Matrix.json` accounts for every declared human-facing state and its visual-evidence disposition.
- `Brightwork_Current_Navigation_Reachability_Report.json` supersedes the stale 109-page Homeport proof for Brightwork and records the current 116 human-facing routes.
- `Brightwork_Evidence_State_Exceptions.json` preserves the replaced unavailable READY frames, their observed copy, and their evidence-only classification.
- `Brightwork_Stage_8_Wave_0_Evidence_Record.json` is the machine-readable final reconciliation for the Wave 0 source binding, state coverage, capture set, and reachability proof.

Run `npm run brightwork:validate` to fail closed on capture binding, preserved-image integrity, declared-state coverage, current navigation reachability, and unresolved READY/unavailable evidence.

The canonical images, auditor index, and contact sheets are in `Experience_Images/`. Their review status is `CAPTURED_PENDING_BRIGHTWORK_REVIEW`; they are not an audit verdict or product-quality acceptance.
