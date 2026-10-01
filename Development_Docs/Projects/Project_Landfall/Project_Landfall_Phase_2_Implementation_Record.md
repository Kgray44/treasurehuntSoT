---
title: Project Landfall Phase 2 implementation record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-implementation
last_reviewed: 2026-09-30
---

# Project Landfall Phase 2: Bring the World Aboard

## Final closure correction candidate

The final correction embeds the actual canonical Chart in `livingChart`, shares one foreground controller with the drawer, releases read-only historical snapshots, and separates block-bound arrival from observation response. Provider-required outcomes are checked before consuming a visit. All eight Captain actions have direct transaction and browser acceptance; stale conflicts persist in the Console. Creator field walks stop on source/selection/background/unmount changes and retain only sanitized source-bound receipts. Released chart/pages, authorized first-party images and one short-lived encrypted evidence item survive appropriate offline reload and reconcile through existing server authority. Responsive and accessibility corrections are limited to evidenced Landfall/Journal/Console defects.

The [final closure record](Project_Landfall_Phase_2_Final_Closure_Record.md) reconciles the earlier completion assertion with exact correction qualification and integration evidence. No Phase 3 or Phase 4 implementation is included.

This record describes source implemented from the accepted Phase 1 mainline (`27f6e08c6ed24ff636a9b31d28abe101344abedf`). Protected integration and hosted qualification are recorded separately in the Phase 2 validation record.

## Canonical ownership

- Creator Studio owns the Chronicle draft, autosave version, conflict handling, undo/redo, validation, and publishing. Its Living Chart workspace edits the same versioned Landfall definition as the Chronicle draft. It offers physical and virtual Worldspaces, maps, visual waypoint and route tools, inspectors, visibility previews, mobile framing, warnings, and a field-test panel.
- The Phase 1 Landfall schema, geometry, observation, runtime, and projection remain the single domain. Studio preview, Player Chart, Captain status, replay, and field-test evaluation call those contracts. Physical and virtual coordinate universes remain distinct.
- Six Chronicle blocks (`livingChart`, `waypointJourney`, `routeJourney`, `locationReveal`, `locationObservation`, `locationChoice`) use the existing Story Block and Drydock registry. The `landfall` completion provider binds a block to a Worldspace, location, required outcome, fallback, Captain override, and presentation-only replay policy.
- One Voyage owns durable visit, skip, reveal, selection, transition, pause, and completion events. Player evidence is requalified against the immutable published edition in the same progression transaction. Browser confidence alone never advances a Passage. Captain commands use the same event stream.
- The Player Journal renders released geometry, current objective, route state, arrival history, and safe offline status. Browser location starts only after a Player action and stops with the chart lifecycle. A historical completed chart is presentation only.
- Waypoint authoring includes descriptions, icon identity, text/nearby/wrong-direction clues, and governed approximate distance and bearing. Route authoring includes full, next-segment, rough-bearing, and hidden presentation, reveal-on-selection, and deviation response. The Player projection withholds hidden routes and limits route lists and map geometry by visibility.
- Lanternwake stages canonical arrival, route, and reveal outcomes on a readable status card; the chart renderer retains map camera ownership. Reduced motion has a static semantic result.

## Storage, privacy, and offline boundary

- SQLite migration `202609300001_landfall_phase2_field_test_receipts` and MySQL migration `0068_landfall_phase2_field_test_receipts` add owner-bound field-test receipts. Source hash and autosave version mark a receipt stale after a draft change. Observations are evaluated in memory; receipts contain bounded diagnostic summaries and no raw physical trail.
- Physical custom imagery uses existing Chronicle asset authorization and WGS84 bounds. Hidden overlays and maps are released only through Player-safe projection; the media endpoint remains private and uncached.
- The web service worker caches a data-free public reload shell and bounded versioned static assets. Released chart/pages and authorized first-party image bytes use encrypted IndexedDB with a tab/session/edition/CSRF lease. A single encrypted evidence package retains at most 20 temporary fixes for 90 seconds across reload and is never displayed as server-confirmed progress before acknowledgment. Chart records expire after 30 minutes; external tiles and authenticated API responses are excluded. Sign-out and access changes clear records and cancel pending Chart restoration.
- Built-in physical raster geography uses OpenStreetMap with visible attribution and network availability truth. No production address/place geocoder or virtual telemetry provider is configured. Coordinate entry, Chronicle location selection, and Player fallback remain available.

## Evidence boundaries

Local synthetic tests can prove source behavior, authorization, validation, migration SQL, and browser journeys. They do not prove outdoor GPS quality, public map-tile availability, production MySQL deployment, live devices, or owner acceptance. Phase 3 indoor positioning and Phase 4 Watchglass recognition are outside this work.
