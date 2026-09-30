---
title: Project Landfall Phase 1 Live Position Closure Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-live-position-closure
last_reviewed: 2026-09-30
---

# Phase 1 Live Position Closure Record

## Authority and correction

The [v1.0 governing baseline](Project_Landfall_Governing_Document_v1.0.pdf), section 23.1, requires a basic Voyage Chart live-position layer in Phase 1. Its contextual-permission, confidence, privacy, and One Voyage ownership rules still apply. The [v1.1 Worldspaces amendment](../../Governing/Project_Landfall_Governing_Amendment_v1.1_Worldspaces_and_Virtual_Navigation.pdf) adds physical and virtual Worldspace support; it does not remove the v1.0 Player slice. The original Phase 1 integration at PR #666 supplied an internal rendering seam but did not connect it to the ordinary Player route. This closure connects that route without replacing the accepted domain/runtime contracts or starting Phase 2.

## Implemented Player path

The real Player Journal map drawer mounts `LandfallJournalChart` and the existing `VoyageChart` only for an active identity-backed Tale Session. The new Player API checks current membership before loading the immutable pinned published definition. Its private, no-store response contains one current Worldspace, the default map, only nonhidden waypoint geometry whose prerequisites are currently satisfied, safe routes, and only a map asset already released by Chronicle. A currently entered Chronicle chapter or block can select its authored destination Worldspace. Phase 1 does not infer a Captain/progression transition or a canonical Landfall visit from local browser observations.

In a physical WGS84 Worldspace, **Use my location** explicitly starts the existing browser provider and Landfall runtime. The ephemeral Player scene carries the qualified coordinate, confidence, observation time, and accuracy. The MapLibre overlay shows a current-position marker, a visual halo, and a readable confidence and estimated-accuracy label. Weak or stale fixes remove the marker and display a readable status. No browser location request occurs on load. **Stop using my location**, closing the drawer, leaving the page, tab backgrounding, permission/provider failure, a paused/revoked/offline journal connection, or a session sequence/version change clears the watch and local marker. Coordinates remain in client memory and are neither posted nor written to a Chronicle event. Local `CONFIRMED` remains a signal only; a visit requires a later One Voyage canonical receipt.

A virtual Worldspace uses the existing SVG vector/image chart without asking for GPS. With no accepted virtual-position provider, it reports that no live virtual position source is connected and displays no invented precise marker.

## Privacy and scope

The Player bootstrap excludes draft definitions, hidden and prerequisite-gated waypoint geometry, inaccessible image assets, other Worldspaces, and unauthorized sessions. Public pages receive no Player position or private map payload. The closure does not add Studio authoring UI, Captain map controls, background/native tracking, virtual game telemetry, public sharing, map tiles, or a canonical completion write.

## Focused proof

TypeScript and focused Landfall/API tests passed on the closure candidate. The dedicated task-owned production-browser journeys passed 4/4: explicit grant and watch teardown with no canonical visit, denied permission, virtual chart without GPS, and unauthorized/hidden-geometry protection. This is synthetic browser proof, not physical handset accuracy, production map tiles, production MySQL, deployment, or owner acceptance. Final Sounding Line and protected integration evidence belong in the [Validation Record](Project_Landfall_Phase_1_Validation_Record.md).
