---
title: Route reference
audience: reference
status: current
canonical_for: route-reference
last_reviewed: 2026-08-02
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

For product intent see [features](../product/features.md); for implementation ownership see [architecture](../developer/architecture.md).
