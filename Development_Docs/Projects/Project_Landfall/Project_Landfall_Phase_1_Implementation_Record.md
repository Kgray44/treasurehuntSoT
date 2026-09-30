---
title: Project Landfall Phase 1 Implementation Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-implementation
last_reviewed: 2026-09-30
---

# Phase 1 Implementation Record

## Governing recovery

The original [v1.0 PDF](Project_Landfall_Governing_Document_v1.0.pdf) was copied without conversion from the owner attachment. Its SHA-256 is `6d37b0c634fc1aa578debbbd79d6eb5a478526ab1143e0e80ee89393203aec5`, matching the attached source. The existing [v1.1 Worldspaces amendment](../../Governing/Project_Landfall_Governing_Amendment_v1.1_Worldspaces_and_Virtual_Navigation.pdf) remains a separate authority. The project home and generated index now expose the baseline first and describe v1.1 as a limited amendment.

## Source inventory

- `src/landfall/schema.ts`, `definition.ts`, and `geometry.ts`: strict version-1 authored domain and deterministic Worldspace-aware geometry.
- `src/landfall/observation.ts`, `browser-geolocation.ts`, and `runtime.ts`: provider capability registry, foreground browser fixes, deterministic replay, qualification, confidence, bounded local evidence, and canonical receipt reconciliation.
- `src/landfall/map-projection.ts`, `map-style.ts`, and `map-renderer.tsx`: filtered physical GeoJSON and virtual SVG/image presentation through a bounded, HTTPS-only trusted style seam and accessible location list. Approximate-region exact centers are omitted from serialized scenes.
- `src/landfall/definition-store.ts` and the private Studio Landfall route: draft persistence, owner/CSRF authorization, optimistic concurrency, and no-store response headers.
- `src/landfall/published.ts` and `progression-boundary.ts`: pinned immutable edition loading and a typed One Voyage completion proposal; no parallel canonical progression write.
- `src/drydock/landfall-adapter.ts`: deterministic physical and virtual simulation mapped into Drydock's accepted result vocabulary.
- `src/app/api/player/playthroughs/[playthroughId]/landfall/route.ts` and `src/landfall/player-bootstrap.ts`: member-authorized, no-store projection from the pinned published edition to currently released evaluation geometry and map assets.
- `src/components/player/journal/LandfallJournalChart.tsx` and `src/components/player/workspace/VoyageChart.tsx`: ordinary Player Journal map drawer, explicit foreground location control, local current-position overlay, and virtual chart fallback. Existing non-Landfall chart behavior remains available.
- Prisma SQLite/MySQL schemas and their Phase 1 migrations: nullable `landfallDefinition` on `TaleDraft`. Chronicle snapshot and publication parsers accept optional version-1 Landfall while retaining old versions without it.

## Reconciliation with v1.0 and v1.1

The physical path is foreground only, with explicit start/stop, accuracy, freshness, speed, dwell, hysteresis, and no durable raw-location history. The v1.0 fallback and One Voyage ownership rules remain in the definition/runtime contracts. V1.1 adds virtual coordinates and semantic observations, and transitions between declared Worldspaces. The implementation has no `HYBRID` Worldspace kind and no GPS dependency in virtual validation or projection. The synthetic fixture contains a physical town and a fictional island Worldspace; it does not use a real private route.

## Availability boundary

Phase 1 now exposes a bounded Player Journal chart for active identity-backed Voyages with a Landfall-enabled pinned edition. The ordinary Studio authoring canvas, Captain controls, background/native location, offline map-package download, virtual game telemetry, Watchglass, and public map publication remain outside this change. One Voyage must issue the canonical completion receipt before Landfall marks a location visited. A forged provider ID or client-side `CONFIRMED` result is never server authority by itself. The [Live Position Closure Record](Project_Landfall_Phase_1_Live_Position_Closure_Record.md) reconciles the v1.0 chart requirement and v1.1 virtual boundary with the ordinary Player route.
