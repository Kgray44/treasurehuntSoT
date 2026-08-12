---
title: Project Helm Repository Index
audience: product-engineering
status: current
canonical_for: project-helm-repository-index
last_reviewed: 2026-08-10
---

# Project Helm

Project Helm governs Captain operations and participating-Captain behavior.
Phase 1, **Take the Helm**, is accepted on canonical main. It establishes
independent Voyage-scoped Captain authority and ordinary Player membership,
including a Player-safe perspective for a Captain who explicitly joins the
crew. It does not authorize Phase 2 operational projections, Needs Attention,
or the larger Helm command experience.

Phase 2, **Read the Deck**, is an active branch candidate based on current
main. Its design record freezes read-only Captain operational projections,
membership-scoped presence/synchronization source-of-truth, privacy,
unknown/stale behavior, and Phase 3/4 exclusions.
It is not accepted in main until governed validation, protected integration,
and actual-integrated-SHA proof are complete.

## Authority

- [Project Helm governing document](../Project%20Helm/Project_Helm_Captain_Operations_and_Participating_Captain_System_Governing_Document_v1.0.pdf),
  version 1.0, SHA-256
  `93ae665c95cf117e6d1c1d4c1d4d14245b0c41da6f9ea343977549683982972d`.
- [Voyagewright Continuous Development and Mainline Integration Standard](../../Governing/Voyagewright_Continuous_Development_and_Mainline_Integration_Standard_v1.0.pdf),
  version 1.0, SHA-256
  `10ba64e3599179814a95d5ee873e3be070a0618fff058506b451dc9666d874a7`.
- [Voyagewright Global Product Governance Standard](../../Governance/Voyagewright_Global_Product_Governance_Standard.md).
- [Project Homeport governing document](../Project_Homeport/Project_Homeport_Governing_Document.md).
- [Sounding Line release validation policy](../../Testing/Release_Validation_Policy.md).

The tracked PDFs are byte-identical to the supplied authorities reviewed for
this phase. They remain governing sources, not implementation evidence.

## Phase 1 records

- [Design Record and Mainline Safety Contract](Project_Helm_Phase_1_Design_Record.md)
- [Test Plan](Project_Helm_Phase_1_Test_Plan.md)
- [Validation Record](Project_Helm_Phase_1_Validation_Record.md)
- [Integration Manifest](Project_Helm_Phase_1_Integration_Manifest.md)
- [Completion Receipt](Project_Helm_Phase_1_Completion_Receipt.md)

## Phase 2 records

- [Design Record](Project_Helm_Phase_2_Design_Record.md)
- [Mainline Safety Contract](Project_Helm_Phase_2_Mainline_Safety_Contract.md)
- [Test Plan](Project_Helm_Phase_2_Test_Plan.md)
- [Validation Record](Project_Helm_Phase_2_Validation_Record.md)
- [Integration Manifest](Project_Helm_Phase_2_Integration_Manifest.md)

Phase 1 acceptance is anchored by protected pull request 31, merge
`d4991766369697584c5d2ea7cba22da903ecab8c`, and the retained Sounding Line
receipt. Local, synthetic, copied-database, and browser evidence remains
distinct from deployment, live-provider, physical-device, and owner-acceptance
proof.
