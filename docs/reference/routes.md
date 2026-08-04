---
title: Route reference
audience: reference
status: current
canonical_for: route-reference
last_reviewed: 2026-08-04
---

# Route reference

Primary route groups are `/player`, `/captain`, `/studio`, `/play`, `/profile`, `/tales`, and controlled API routes. Access depends on authentication, role, ownership, and invitation policy; route knowledge does not grant authorization. Compatibility route groups are transitional and are not a preferred integration surface.

The Project Homeport Phase 3 branch adds ordinary Personal Harbor routes under
`/account` and `/passport`. Account descendants cover Profile, personal
information, preferences, accessibility, notifications, privacy, linked
identities, Security, Sessions & Devices, and Data & Account. Passport
descendants cover history and version-pinned detail, Memories, Artifact Cabinet
and artifact detail, and Saved from Community. `/profile/[handle]` is the
separate public projection. These routes are branch-complete, not on main.

Phase 4 makes `/community` the content-first Harbor Home. Ordinary districts
are `/community/featured`, `/chronicles`, `/artifacts`, `/templates`, `/maps`,
`/audio`, `/creators`, `/collections`, `/guides`, and `/voyage-logs`. Public
details use `/community/[slug]`, `/creators/[handle]`,
`/collections/[slug]`, `/guides/[slug]`, and `/voyage-logs/[slug]`.
Shipwright's Workshop is a governed Guide-category view, not a second content
store. Moderation and owner/consent routes remain capability or workflow
surfaces, not ordinary public districts.

Project Homeport Phase 5 classifies all 85 page routes as ordinary static,
contextual dynamic, tokenized, compatibility, or development-only surfaces.
The branch publishes parent/return metadata, genuine dynamic source controls,
safe token states, compatibility targets, and equivalent desktop/mobile entry
edges. Ordinary navigation never exposes token values or treats a private
detail ID as discoverable. This graph is complete on the named branch only; it
is not on `main`, deployed, or owner accepted.

Phase 6 re-censused the same current source at 85 page routes and 174 API/route
handlers, with no omitted page source. It adds screen/state/responsive evidence
without changing route ownership or creating a second navigation authority.
The result is exact-source branch validation, not Phase 7 integrated journey or
deployment proof.

For product intent see [features](../product/features.md); for implementation ownership see [architecture](../developer/architecture.md).
