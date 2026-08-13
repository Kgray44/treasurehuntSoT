---
title: Project Shipwright Phase 3 Block Readiness Matrix
audience: engineering
status: active
canonical_for: project-shipwright-phase-3-block-readiness
last_reviewed: 2026-08-13
---

# Project Shipwright Phase 3 Block Readiness Matrix

## Audit method and result

The audited source is the current 23-type Drydock contract registry, its Phase 2 static-rule catalog, canonical runtime/publication reader, historical compatibility fixtures, and current Shipwright authoring adapters. `ACTIVE_CURRENT` means the Appendix A capability already exists under an accepted canonical type; it is not a new activation. `READY_VIA_CANONICAL_COMPOSITION` means a Creator may make the named presentation using an existing canonical block/template without a new semantic block. No `READY_FOR_PHASE3` type exists in this fetched mainline, so no new semantic block is added in Phase 3.

| Candidate             | Family      | Canonical owner/primitive                | Contract, static, runtime, preview/publish/history, a11y             | Phase 3 decision                  |
| --------------------- | ----------- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| Rich Narrative        | Narrative   | Drydock/One Voyage `narrative`           | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Dialogue              | Narrative   | `narrative` composition                  | No dialogue semantic contract; narrative path exists                 | `READY_VIA_CANONICAL_COMPOSITION` |
| Letter                | Narrative   | `narrative` composition                  | No distinct semantic contract                                        | `READY_VIA_CANONICAL_COMPOSITION` |
| Journal Entry         | Narrative   | `narrative` composition                  | No distinct semantic contract                                        | `READY_VIA_CANONICAL_COMPOSITION` |
| Character Message     | Narrative   | `captainsNote`/`narrative`               | Existing message/narrative contracts                                 | `READY_VIA_CANONICAL_COMPOSITION` |
| Quote                 | Narrative   | `narrative` composition                  | No distinct semantic contract                                        | `READY_VIA_CANONICAL_COMPOSITION` |
| Timeline              | Narrative   | None                                     | No contract/runtime reader                                           | `BLOCKED_DRYDOCK_CONTRACT`        |
| Choice                | Interaction | `choice`                                 | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Multi-select          | Interaction | None                                     | No contract, completion semantics, or reader                         | `BLOCKED_DRYDOCK_CONTRACT`        |
| Ranking               | Interaction | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Slider                | Interaction | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Checklist             | Interaction | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Matching              | Interaction | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Sequence Puzzle       | Interaction | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Voting                | Interaction | None                                     | No crew/runtime owner contract                                       | `BLOCKED_SEMANTIC_OWNER`          |
| Image Gallery         | Media       | None                                     | No gallery contract/reader                                           | `BLOCKED_DRYDOCK_CONTRACT`        |
| Audio Scene           | Media       | `audio`                                  | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Video                 | Media       | `cinematic`                              | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Ambient Audio         | Media       | `audio` composition                      | Existing audio/transcript fallback only                              | `READY_VIA_CANONICAL_COMPOSITION` |
| Before/After          | Media       | `imageTransformation`                    | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Panorama              | Media       | None                                     | No contract/runtime/accessibility fallback                           | `BLOCKED_RUNTIME`                 |
| Document/Parchment    | Media       | `narrative` plus asset                   | No document semantic contract                                        | `READY_VIA_CANONICAL_COMPOSITION` |
| Interactive Artifact  | Media       | Artifact/Wayfarer `artifactReveal`       | Reveal exists; interactive behavior does not                         | `BLOCKED_SEMANTIC_OWNER`          |
| Living Chart          | World       | None                                     | No Landfall contract/runtime                                         | `BLOCKED_PROVIDER`                |
| Location Arrival      | World       | `arrivalCheck`                           | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Route                 | World       | None                                     | No accepted location-route block contract                            | `BLOCKED_SEMANTIC_OWNER`          |
| Region                | World       | None                                     | No accepted location-region block contract                           | `BLOCKED_SEMANTIC_OWNER`          |
| Compass/Bearing       | World       | `travelDirection` composition            | Existing direction contract, no distinct runtime semantic            | `READY_VIA_CANONICAL_COMPOSITION` |
| Vision Waypoint       | World       | Watchglass provider                      | Registry has only provider option; no accepted adapter/runtime proof | `BLOCKED_PROVIDER`                |
| Environmental Cue     | World       | None                                     | No semantic owner/contract                                           | `BLOCKED_SEMANTIC_OWNER`          |
| Condition             | Logic       | `condition`                              | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Variable Operation    | Logic       | `setVariable`                            | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Counter               | Logic       | None                                     | No counter contract/runtime                                          | `BLOCKED_DRYDOCK_CONTRACT`        |
| Inventory Requirement | Logic       | Artifact/Wayfarer                        | No accepted requirement contract/runtime                             | `BLOCKED_SEMANTIC_OWNER`          |
| Composite Requirement | Logic       | None                                     | No contract/runtime                                                  | `BLOCKED_DRYDOCK_CONTRACT`        |
| Random Branch         | Logic       | None                                     | No deterministic runtime primitive                                   | `BLOCKED_RUNTIME`                 |
| Weighted Branch       | Logic       | None                                     | No deterministic runtime primitive                                   | `BLOCKED_RUNTIME`                 |
| Cooldown              | Logic       | None                                     | No temporal semantic contract                                        | `BLOCKED_DRYDOCK_CONTRACT`        |
| Schedule              | Logic       | None                                     | No calendar/runtime contract                                         | `BLOCKED_DRYDOCK_CONTRACT`        |
| Captain Approval      | Crew        | `captainApproval`                        | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| All Players Ready     | Crew        | None                                     | No crew readiness owner/runtime                                      | `BLOCKED_SEMANTIC_OWNER`          |
| Quorum                | Crew        | None                                     | No crew quorum owner/runtime                                         | `BLOCKED_SEMANTIC_OWNER`          |
| Individual Objective  | Crew        | None                                     | No per-player objective contract                                     | `BLOCKED_SEMANTIC_OWNER`          |
| Shared Decision       | Crew        | `choice` presentation only               | No shared-consensus runtime                                          | `BLOCKED_SEMANTIC_OWNER`          |
| Private Information   | Crew        | Existing private fields                  | No reusable private-information semantic block                       | `DEFERRED_GOVERNED`               |
| Role Assignment       | Crew        | None                                     | No role-assignment owner/runtime                                     | `BLOCKED_SEMANTIC_OWNER`          |
| Artifact Reveal       | Ceremony    | `artifactReveal`                         | Current/current/current/current/current                              | `ACTIVE_CURRENT`                  |
| Chapter Unlock        | Ceremony    | `chapterComplete` composition            | Existing completion semantics, no distinct unlock block              | `READY_VIA_CANONICAL_COMPOSITION` |
| Major Discovery       | Ceremony    | `artifactReveal`/`narrative` composition | No distinct runtime semantic                                         | `READY_VIA_CANONICAL_COMPOSITION` |
| Finale                | Ceremony    | `taleComplete` composition               | Current terminal primitive exists                                    | `READY_VIA_CANONICAL_COMPOSITION` |
| Celebration           | Ceremony    | None                                     | No ceremony runtime/fallback contract                                | `BLOCKED_SEMANTIC_OWNER`          |
| Keepsake Moment       | Ceremony    | Wayfarer keepsake                        | No accepted authoring block contract                                 | `BLOCKED_SEMANTIC_OWNER`          |

## Totals

- 52 Appendix A candidates audited.
- 10 `ACTIVE_CURRENT` semantic types.
- 11 `READY_VIA_CANONICAL_COMPOSITION` presentation/reuse patterns.
- 0 `READY_FOR_PHASE3` new semantic types and therefore 0 semantic activations.
- 12 blocked by missing Drydock contract; 13 blocked by semantic owner; 3 blocked by runtime; 2 blocked by provider; 1 governed deferral.

The totals deliberately count a candidate exactly once. Reusable templates/presets may expose only the active canonical primitives and composition patterns above, and must label their canonical behavior accurately rather than presenting a new block type.
