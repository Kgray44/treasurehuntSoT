---
title: Project Landfall Phase 3 contextual navigation design
audience: product-engineering
status: current
canonical_for: project-landfall-phase-3-design
last_reviewed: 2026-10-01
---

# Read the Ground

Phase 3 extends the accepted [Phase 2 closure](Project_Landfall_Phase_2_Final_Closure_Record.md) at `01cf22976dcf32e7fa4a3bf75d47b96d677f26ec`. Protected main had not advanced at startup. Project Trim uses that capsule and a bounded context packet/read-search logbook in `.agents`; prior records remain historical evidence.

## Canonical architecture

Optional `LandfallDefinition.context` adds bounded regions and natural landmarks to the existing JSON definition. Maps may name a level, waypoints a region/landmark, and routes the region of each geometry segment. Regions reuse Worldspace references and existing point/polygon/corridor/gate geometry. Validation checks identity, scope, hierarchy cycles, level/map consistency, geometry, privacy and mandatory fallback. Reference images must belong to the Chronicle's protected image library; used floor/landmark assets cannot be archived silently.

No database schema or migration changes are required. Legacy definitions omit these optional fields. Published editions freeze definition and media variants independently of mutable drafts. One Voyage remains the only canonical writer: local contextual snapshots supply guidance, server-requalified evidence proposes arrival, and the existing transaction owns events and Passage completion.

The runtime integrates typed foreground position, motion, heading, elevation, regional observation and landmark evidence. Snapshots contain categorical state, region/map/level IDs, reasons, evidence categories, route match and expiry. Raw streams do not become canonical history.

## Honest confidence

GPS retains accepted broad arrival behavior. Fine room/gallery/floor/exhibit, indoor, exact-object and landmark GPS outcomes are capped at likely inside. Overlapping floor footprints remain ambiguous. Independent observation or region-gated landmark evidence can narrow context. No probability percentage or claim of GPS identifying adjacent objects is displayed.

Corridor matching combines width, nearest segment and uncertainty with continuity, direction and plausible travel. Parallel corridors, intersections, branches, loops and backtracking retain ambiguity when evidence cannot distinguish them. Segment regions narrow context only with useful continuity. Hysteresis prevents boundary oscillation; expiry broadens through bounded uncertain grace to unavailable.

Optional browser heading/motion acquisition needs a separate action and shares foreground controller ownership. Noisy/stationary/device-rotation hints cannot establish exact position. Browser altitude with reported uncertainty may indicate a vertical transition; there is no authored absolute-height calibration, so it never invents a floor label. Unsupported capabilities and denial keep the Chart and fallback usable.

## Authoring and projections

Creators upload normal protected assets, align floor/site image overlays, label levels, draw hierarchical entrances/rooms/galleries/corridors/stairs using existing tools or keyboard coordinate entry, and associate waypoint and route regions. Landmark controls select positive/negative references, guidance, minimum frames, privacy and fallback. Publication findings block invalid assets, unsafe public/private layouts, missing mandatory fallbacks and exact targets lacking independent verification.

The same released geometry serves the existing embedded Chart and drawer, Creator preview, Captain and replay. Viewing a floor is distinct from inferring it. Authorized enrolled Players can see private Chronicle layouts; hidden/unreleased geometry and assets remain withheld. Public projections reveal no private layout or live position. Captain views receive sanitized canonical contextual summaries and existing authorized fallback actions. Replay uses recorded categories and fallback attribution without acquiring location, camera, heading or motion.

## Landmark and exact-target verification

Targeted source inspection found the declared `visionLocation` contract (`match`, `notMatch`, `uncertain`) but no accepted recognition engine. The Landfall extension uses that vocabulary for conservative comparison with an authored reference view. Several clear frames must agree; low-detail, negative or ambiguous views cannot confirm. This is view appearance comparison, not general object recognition. Changed angle, lighting, crowds or occlusion may require the readable fallback. Physical recognition quality is a separate field-acceptance boundary.

Camera access and comparison are explicit. A few small stills exist only during the requested comparison. Before reading immutable authorized reference variants, the server requalifies recent regional evidence and ancestor geometry, objective availability, membership, CSRF, rate limits, session/edition/sequence and image count/size/decoded-pixel bounds. It retains no Player frames. A process-local signed result expires within 30 seconds and binds Player, Voyage, edition, sequence, waypoint, landmark, region and definition checksum. Restart requires re-verification; client-declared success is rejected.

For a matching exact-target `locationObservation`, qualified likely-inside broad arrival records an explicit contextual-arrival marker and unlocks the prompt. The text answer, deliberate observation confirmation or Captain response remains separate. GPS and its arrival fallback alone cannot configure an exact-object objective. Signed landmark confirmation also passes through the normal Landfall completion/One Voyage transaction.

## Privacy, offline and qualification

Local snapshots, optional sensor hints and camera stills are transient. Canonical summaries and field receipts retain IDs/categories/outcomes rather than exact coordinates or frames. Landmark receipts and contextual streams are excluded from the offline outbox. Released floor assets share the accepted six-image/four-MiB encrypted cache; partial caching and online-only external tiles remain visible. Same-tab lease, authorization, edition, sequence and TTL requalification are preserved. Offline camera verification needs reconnect or fallback.

Freshness loss, denial, backgrounding, sign-out, edition/source change and unmount release owned acquisition. Invalid/stale evidence, impossible jumps, floor/corridor ambiguity and reference mismatch yield understandable uncertainty. Mandatory visual/exact targets have readable accessible alternatives.

Fictional museum and garden/conservatory fixtures cover property/entrance, two-floor or regional hierarchy, galleries, parallel corridors, natural landmark, independent plaque observation, optional discovery and fallback. Production-browser controls use synthetic hardware input and owned accounts/database/ports, all four required viewports, 200% text, keyboard/focus, reduced motion, forced colors and scoped accessibility scans alongside retained Phase 1/2 journeys. The [validation record](Project_Landfall_Phase_3_Validation_Record.md) records measured gates and failed evidence. Acceptance requires exact-candidate ordinary Sounding Line, hosted PASS, protected merge and landed verification.

Phase 4 remains deferred: native apps/background location/geofencing/screen-lock tracking, native offline regions/notifications/sensor frameworks, optional UWB/beacon/NFC/QR, production infrastructure/monitoring, final privacy/performance launch review and launch readiness. Physical field quality, live assistive technology, deployment and owner acceptance require separate evidence.
