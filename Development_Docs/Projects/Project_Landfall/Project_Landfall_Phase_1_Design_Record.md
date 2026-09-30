---
title: Project Landfall Phase 1 Design Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-design
last_reviewed: 2026-09-30
---

# Phase 1 Design Record

## Authority and reconciliation

The [v1.0 governing baseline](Project_Landfall_Governing_Document_v1.0.pdf) remains the governing source for physical navigation, foreground consent, zero-infrastructure operation, confidence, safety, privacy, and One Voyage ownership. The [v1.1 amendment](../../Governing/Project_Landfall_Governing_Amendment_v1.1_Worldspaces_and_Virtual_Navigation.pdf) explicitly extends the domain to `PHYSICAL` and `VIRTUAL` Worldspaces. A hybrid Chronicle contains multiple Worldspaces, not a third kind. Existing Chronicle and Drydock source defines their current integration contracts.

The recovered v1.0 PDF was checked against the Phase 1 implementation. The original physical-only assumption is superseded by v1.1; the physical provider and confidence path still honor v1.0. The initial integration omitted v1.0 section 23.1's ordinary Player live-position Chart, despite providing an internal scene seam. The [closure correction](Project_Landfall_Phase_1_Live_Position_Closure_Record.md) connects that seam to the Player Journal while retaining the compliant domain/runtime code. The recovered baseline is preserved byte-for-byte, and this record is explanatory rather than a substitute.

## Ownership

| Concern          | Owner and Phase 1 contract                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landfall         | Strict definition, coordinate references, geometry, observations, confidence, bounded runtime, safe map and journey projections                                        |
| Chronicle Studio | Owner/CSRF-protected draft storage and optimistic versioning                                                                                                           |
| One Voyage       | Immutable published edition, session pin, canonical sequence and event transaction; Landfall supplies only a typed completion proposal and consumes canonical receipts |
| Drydock          | Deterministic simulation through its `MATCH`/`NO_MATCH`/`UNCERTAIN` adapter                                                                                            |
| Watchglass       | Future source capability only; no Phase 1 vision provider                                                                                                              |
| Storytide        | Future transition presentation; Phase 1 records transition intent and destination readiness                                                                            |

## Domain boundaries

`src/landfall/schema.ts` defines version 1 Worldspace, reference, map, waypoint, route, transition, evidence, privacy, and offline contracts. Coordinates carry Worldspace ID, reference ID, version, and type. Definition validation rejects unknown fields and cross-reference errors before draft save or publication. The supported references are WGS84 and custom georeferenced physical space plus local Cartesian, normalized image, and custom vector virtual space. No implicit conversion between physical and virtual units is allowed.

`src/landfall/geometry.ts` performs bounded distance, bearing, containment, gate crossing, corridor and route progress operations. Georeferenced physical coordinates require an invertible authored transform and residual uncertainty. Browser geolocation uses WGS84 only. `src/landfall/observation.ts` has a capability registry and finite deterministic replay source. Registration declares availability; it is not an attestation that untrusted client evidence is genuine.

`src/landfall/runtime.ts` keeps bounded, in-memory qualified fixes and evidence state. Physical position requires acceptable age, accuracy, speed, repeated samples, and dwell before local confirmation. Virtual semantic or position evidence uses source identity, confidence, corroboration, and Worldspace bounds without GPS. Local confirmation does not mark a waypoint visited. A canonical One Voyage receipt is required for server-confirmed journey state. Pause, denial, unavailable provider, missing destination assets, offline state, and uncertain boundaries degrade explicitly.

## Persistence and presentation

`TaleDraft.landfallDefinition` is nullable in SQLite and MySQL. Studio saves are owner protected and use the existing `autosaveVersion` concurrency field. Published snapshots may include an optional validated Landfall definition; old snapshots remain readable. A Tale Session resolves Landfall from its pinned `PublishedTaleVersion`, never from the mutable draft.

`projectLandfallMap` accepts a role-filtered Chart projection and rejects public map output in Phase 1. The MapLibre-compatible physical adapter accepts only trusted application style providers; the virtual adapter draws an image/vector scene. Both have bounded feature input and a text fallback. The Player bootstrap checks Tale Session membership and the pinned edition before returning only released evaluation geometry. The ordinary Player Journal map drawer mounts the existing Voyage Chart, whose physical scene can display a qualified foreground position and accuracy. Virtual scenes display without GPS; no virtual live source is assumed. Normal non-Landfall chart behavior remains intact. This bounded Phase 1 chart is not the final Living Chart.

## Intentional limits

There is no background tracking, native mobile provider, automatic progression write, final Creator map canvas, public map publication, service-worker map region pack, or production Watchglass/game integration. Map asset delivery and supported MySQL server migration still require deployment-specific proof recorded in the [Validation Record](Project_Landfall_Phase_1_Validation_Record.md).
