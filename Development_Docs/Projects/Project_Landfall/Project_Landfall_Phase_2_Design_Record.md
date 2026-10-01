---
title: Project Landfall Phase 2 design record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-design
last_reviewed: 2026-09-30
---

# Phase 2 design record

The [v1.0 governing document](Project_Landfall_Governing_Document_v1.0.pdf), [v1.1 Worldspaces amendment](../../Governing/Project_Landfall_Governing_Amendment_v1.1_Worldspaces_and_Virtual_Navigation.pdf), and accepted Phase 1 contracts govern this design. Phase 2 connects authoring, Chronicle blocks, Player, Captain, replay, field testing, and a bounded web offline foundation to those contracts.

## Ownership and flow

1. Creator Studio edits `landfallDefinition` in the existing TaleDraft autosave and optimistic-version transaction. The Living Chart canvas and inspector share the draft's undo/redo history. Publishing pins a validated immutable definition.
2. Six location blocks use the existing Story Block registry, Drydock contracts, and One Voyage block progression. The reusable completion provider requests a typed Landfall outcome; it does not create a second voyage state store.
3. Canonical Tale Session events carry visit, reveal, route choice, transition, skip, and pause state. The Player bootstrap projects only the active published Worldspace and authorized map assets. The server evaluates submitted evidence again against that published edition before an event advances progress.
4. Captain actions append governed events through the same sequence/idempotency boundary. Completed-voyage replay reads historical events and cannot request location or write progress.
5. Field tests evaluate transient observations against the same runtime and store a bounded owner-bound diagnostic receipt, with source hash and autosave version for staleness.

## Map and route presentation

Physical maps use attributed interactive raster geography when online. Virtual maps use an authored vector plane or an existing Chronicle image asset. Private overlays use the existing asset authorization path. Map projection filters hidden features and trims a `NEXT_SEGMENT` route to the currently eligible leg; `ROUGH_BEARING` and unrevealed `HIDDEN` routes do not put a path on the map. Accessible text continues to present the current objective and visited history.

The active `livingChart` Passage and Map drawer consume one Journal controller. Historical Passage snapshots are released, as-of-completion projections and own no location watcher. `locationObservation` requires a matching block-bound canonical arrival before projecting its prompt; a separate configured response advances the normal block transaction. Earlier visits do not answer a later observation; fresh qualified context can revisit that waypoint without duplicating the journey's visited set.

The web offline foundation uses encrypted IndexedDB for already released chart data, Landfall pages and authorized first-party images. A tab-scoped session/edition/CSRF capability opens the records; sign-out and access changes revoke it. The 30-minute chart budget is four Voyages, 512 KiB chart data and six images totaling 4 MiB per Voyage. The single 48 KiB delivery item holds at most 20 temporary fixes for 90 seconds. It is never canonical until reauthentication and server requalification succeed. Public versioned shell/static assets are separate from authenticated responses and external tiles. The public data-free fallback restores the authorized tab's bounded records after reload.

## Boundaries

No native offline package, indoor positioning, Watchglass recognition, or production geocoder is added. External tile availability, real handset accuracy, production MySQL deployment, and owner acceptance require separate evidence.
