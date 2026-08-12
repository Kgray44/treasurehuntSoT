---
title: Project Bridgewatch Phase 2 Project Registry Backfill
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-2-registry-backfill
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 2 Project Registry Backfill

This source-indexed backfill preserves every currently discovered governed
project as a durable record. It is not a completion inference. `UNKNOWN`
means the records located during the one bounded source pass were not enough to
make a lifecycle assertion.

| Project       | State    | Known phases                  | Primary source                                                               | Backfill boundary                                                     |
| ------------- | -------- | ----------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Bridgewatch   | ACTIVE   | 1 merged, 2 active, 3 planned | `Project_Bridgewatch_Phase_1_Design_Record.md`                               | Phase 2 has no acceptance record.                                     |
| Sounding Line | COMPLETE | 1-4 complete                  | `Programs/Sounding_Line/Project_Sounding_Line_Program_Completion_Receipt.md` | Program receipt records `RELEASE_GO`.                                 |
| Helm          | ACTIVE   | 1 complete, 2 active          | `Projects/Project_Helm/Project_Helm_Phase_1_Completion_Receipt.md`           | Phase 1 only is accepted.                                             |
| Tideglass     | ACTIVE   | 1 complete, 2 active          | `Projects/Project_Tideglass/Project_Tideglass_Phase_1_Completion_Receipt.md` | Phase 2 remains separate.                                             |
| Lanternwake   | COMPLETE | 1-6 complete                  | `Programs/Lanternwake/Project_Lanternwake_Completion_Receipt.md`             | Historical limitations remain visible.                                |
| Admiralty     | ACTIVE   | 1 merged, 2 active            | `Projects/Project_Admiralty/Project_Admiralty_Phase_1_Completion_Receipt.md` | Phase 2 has no accepted record.                                       |
| Deepwater     | ACTIVE   | 1-2 complete, 3 active        | `Programs/Deepwater/deepwater-phase-status.json`                             | Current phase status is retained.                                     |
| Drydock       | ACTIVE   | 1 merged, 2 active            | `Projects/Project Drydock/Project_Drydock_Governing_Document.pdf`            | Governing source and phase records disagree on final project closure. |
| Wakebook      | ACTIVE   | 1 active                      | `Projects/Project Wakebook/Project_Wakebook_Governing_Document.pdf`          | No accepted Phase 1 record.                                           |
| Shipwright    | ACTIVE   | 1 active                      | `Projects/Project Shipwright/Project_Shipwright_Phase_1_Design_Record.md`    | No accepted Phase 1 record.                                           |
| Homeport      | ACTIVE   | 1 complete, 7 active          | `Projects/Project_Homeport/Project_Homeport_Mainline_Integration_Record.md`  | Owner decision remains separate.                                      |
| Harborlight   | UNKNOWN  | recorded phase                | `Programs/Harborlight/Project_Harborlight_Phase_1_Design_Record.md`          | No accepted project lifecycle record found.                           |
| One Voyage    | UNKNOWN  | recorded phase                | `Programs/One_Voyage/Project_One_Voyage_Phase_2_Completion_Report.md`        | No accepted project lifecycle record found.                           |
| Wayfarer      | UNKNOWN  | recorded phase                | `Programs/Wayfarer/Project_Wayfarer_Phase_1_Design_Record.md`                | No accepted project lifecycle record found.                           |
| Sealed Hold   | UNKNOWN  | Phase 2 record                | `Programs/Sealed_Hold/Project_Sealed_Hold_Phase_2_Completion_Receipt.md`     | Located receipt is not project-level acceptance.                      |
| Ledgerlight   | UNKNOWN  | recorded phase                | `Programs/Other/Project_Ledgerlight_Completion_Receipt.md`                   | Retained receipt is historical.                                       |
| True North    | UNKNOWN  | recorded phase                | `Project_True_North_Completion_Receipt.md`                                   | Receipt says reconciliation was pending.                              |

No global percentage is calculated. The registry currently has no explicit,
complete project-weight denominator; every progress field therefore remains
`UNMEASURED` until governed milestone weights and accepted states are sourced.
