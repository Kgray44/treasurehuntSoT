---
title: Project Helm Repository Index
audience: product-engineering
status: current
canonical_for: project-helm-repository-index
last_reviewed: 2026-08-27
---

# Project Helm

Project Helm governs Captain operations and participating-Captain behavior.
Phase 1, **Take the Helm**, is accepted on canonical main. It establishes
independent Voyage-scoped Captain authority and ordinary Player membership,
including a Player-safe perspective for a Captain who explicitly joins the
crew. It does not authorize Phase 2 operational projections, Needs Attention,
or the larger Helm command experience.

Phase 2, **Read the Deck**, is accepted on canonical main. It adds read-only
Captain operational projections, membership-scoped presence and synchronization
truth, privacy-safe attention/status/event summaries, and a prioritized Voyage
Library while preserving Phase 1 authority and ordinary Player membership.
The accepted result stopped before the interposed amendments, the original
Phase 3 command redesign, and Phase 4 preflight/recovery work.

Governing Amendment v1.1 supplements (and does not replace) the v1.0 governing
document. It inserts three amendments after accepted Phase 2 and before the
unchanged original Phase 3: A1 **Muster the Crew**, A2 **Pass the Helm**, and
A3 **Ready the Room**. A1 and A2 are accepted on canonical main: A1 provides
ordinary invitation, removal, voluntary-leave, and cancellation lifecycle
actions; A2 adds scoped Captain transfer, Succession Hold, takeover, and
ordinary Player solo continuation. A3 makes those existing states and actions
legible in a Captain/Player muster without starting original Phase 3.

## Authority

- [Project Helm governing document](../Project%20Helm/Project_Helm_Captain_Operations_and_Participating_Captain_System_Governing_Document_v1.0.pdf),
  version 1.0, SHA-256
  `93ae665c95cf117e6d1c1d4c1d4d14245b0c41da6f9ea343977549683982972d`.
- [Project Helm Governing Amendment v1.1](../Project%20Helm/Project_Helm_Governing_Amendment_v1.1_Crew_Lifecycle_Captain_Succession_and_Muster_Experience.pdf),
  SHA-256
  `a97dc9de4a5a7c94d0c74af7be5776fef8f0d710614ababbd8d19b67ee95b536`.
- [Voyagewright Continuous Development and Mainline Integration Standard](../../Governing/Voyagewright_Continuous_Development_and_Mainline_Integration_Standard_v1.0.pdf),
  version 1.0, SHA-256
  `10ba64e3599179814a95d5ee873e3be070a0618fff058506b451dc9666d874a7`.
- [Voyagewright Global Product Governance Standard](../../Governance/Voyagewright_Global_Product_Governance_Standard.md).
- [Project Homeport governing document](../Project_Homeport/Project_Homeport_Governing_Document.md).
- [Sounding Line release validation policy](../../Testing/Release_Validation_Policy.md).

The tracked PDFs are byte-identical to the supplied authorities reviewed for
their governing revisions. They remain active governing sources, not
implementation evidence.

## Effective governed sequence

1. P1 **Take the Helm**
2. P2 **Read the Deck**
3. A1 **Muster the Crew**
4. A2 **Pass the Helm**
5. A3 **Ready the Room**
6. P3 **Give the Orders**
7. P4 **Weather the Passage**
8. P5 **Clear for Voyage**

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
- [Completion Receipt](Project_Helm_Phase_2_Completion_Receipt.md)

## Phase 3 records

- [Design Record](Project_Helm_Phase_3_Design_Record.md)
- [Mainline Safety Contract](Project_Helm_Phase_3_Mainline_Safety_Contract.md)
- [Test Plan](Project_Helm_Phase_3_Test_Plan.md)

Phase 3 **Give the Orders** establishes the contextual live Captain command
console. Its validation, integration, and completion records carry the exact
candidate, ordinary Sounding Line Mainline Decision, protected merge, and
landed-smoke evidence when each is available.

## Phase 4 records

- [Design Record](Project_Helm_Phase_4_Design_Record.md)
- [Test Plan](Project_Helm_Phase_4_Test_Plan.md)

Phase 4 **Weather the Passage** adds provider-neutral preflight and governed
recovery reading after accepted P3. Missing adjacent provider contracts remain
truthfully unknown; no provider result is fabricated to permit a launch or
repair.

## Phase 5 records

- [Design Record](Project_Helm_Phase_5_Design_Record.md)
- [Test Plan](Project_Helm_Phase_5_Test_Plan.md)

Phase 5 **Clear for Voyage** completes Helm's existing Captain experience with
an accessible readiness handoff, responsive polish, and truthful closure
boundaries. The required physical owner walkthrough remains external to source
acceptance.

## Amendment A2 records

- [Design Record](Project_Helm_Amendment_A2_Design_Record.md)
- [Test Plan](Project_Helm_Amendment_A2_Test_Plan.md)
- [Validation Record](Project_Helm_Amendment_A2_Validation_Record.md)
- [Integration Manifest](Project_Helm_Amendment_A2_Integration_Manifest.md)

## Amendment A3 records

- [Design Record](Project_Helm_Amendment_A3_Design_Record.md)
- [Test Plan](Project_Helm_Amendment_A3_Test_Plan.md)
- [Validation Record](Project_Helm_Amendment_A3_Validation_Record.md)
- [Integration Manifest](Project_Helm_Amendment_A3_Integration_Manifest.md)
- [Completion Receipt](Project_Helm_Amendment_A3_Completion_Receipt.md)

Amendment A3 is accepted on canonical main through protected pull request 489.
Its [completion receipt](Project_Helm_Amendment_A3_Completion_Receipt.md)
records the exact candidate, ordinary Sounding Line decision, merge/tree
parity, and landed smoke.

Phase 2 was initially integrated through protected pull request 35. Its final
current-main repair is anchored by protected pull request 53, candidate
`61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00`, and merge
`920d92a51a16d60a2dfe35278598e6d921be7e4c`. The hosted Sounding Line mainline
decision returned `RELEASE_GO`; local, synthetic, copied-database, and browser
evidence remains distinct from deployment, live-provider, physical-device, and
owner-acceptance proof.

Phase 1 acceptance is anchored by protected pull request 31, merge
`d4991766369697584c5d2ea7cba22da903ecab8c`, and the retained Sounding Line
receipt. Local, synthetic, copied-database, and browser evidence remains
distinct from deployment, live-provider, physical-device, and owner-acceptance
proof.
