---
title: Project Landfall Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-integration-manifest
last_reviewed: 2026-09-30
---

# Phase 1 Integration Manifest

| Boundary              | Phase 1 integration                                                                                                             | Owner of canonical state                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Creator Studio draft  | Nullable validated Landfall JSON, private GET/PUT and autosave conflict check                                                   | Existing Studio `TaleDraft`                    |
| Chronicle publication | Optional Landfall copied into immutable published snapshot                                                                      | Existing `PublishedTaleVersion`                |
| Active Voyage         | Member-authorized Player bootstrap uses session's exact published version and currently released evaluation geometry; no mutable draft read | One Voyage `TaleSession` and published edition |
| Completion            | Typed proposal includes session/version/Worldspace/waypoint/evidence/sequence/idempotency key; receipt drives confirmed journey | One Voyage event transaction                   |
| Drydock               | Adapter invokes real Landfall runtime on deterministic fixtures, returns accepted three-state result                            | Drydock test/simulation framework              |
| Player Chart          | Ordinary Journal map drawer shows a released physical or virtual scene; physical position needs explicit foreground consent and remains local | Existing Voyage Chart and Player authorization |
| Watchglass            | Future observation source enum only; no provider marked available                                                               | Watchglass future phase                        |
| Storytide             | Transition presentation hint and destination readiness policy only                                                              | Storytide future phase                         |

The SQLite migration is additive and nullable. The MySQL migration uses the same nullable column contract. No existing story-block or legacy location field is rewritten. Existing Chronicles without Landfall still parse and publish. The [Test Plan](Project_Landfall_Phase_1_Test_Plan.md) and [Validation Record](Project_Landfall_Phase_1_Validation_Record.md) track actual qualification and deployment limits.
