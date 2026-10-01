---
title: Project Landfall Phase 2 threat model
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-threat-model
last_reviewed: 2026-09-30
---

# Phase 2 threat model

## Protected assets and trust boundaries

The pinned Landfall definition, hidden geometry, private map media, physical observations, Tale Session events, and Creator field-test receipts are protected. Browser confidence is untrusted; the server checks role, membership, CSRF, request size, pinned edition, sequence, idempotency, observation source, freshness, accuracy, route/waypoint policy, and fallback authority before a visit event. Captain commands use the same event ledger and expose coarse progress rather than exact coordinates.

The Creator browser may evaluate a physical test walk, but raw coordinates are not persisted in the receipt. The receipt stores bounded diagnostic codes and a source identity so a later draft edit makes it stale. The Player chart releases only the active Worldspace and authorized assets; hidden features stay out of the scene and media responses are private and uncached. An approximate-region center is withheld from map feature output.

The encrypted IndexedDB cache is bound to the current session, published version, and CSRF identity, with a tab-scoped capability. Released chart/pages expire after 30 minutes and are bounded to four Voyages. Authorized first-party images use a separate six-image/4 MiB budget. A single encrypted delivery item retains at most 20 fixes and 48 KiB for 90 seconds, then is deleted. This narrow temporary delivery retention never becomes raw trail history. Reconnect checks current access, sequence, edition, replay state and freshness before the existing server evidence evaluator accepts an event. Retries preserve delivery identity and do not extend expiry. Terminal rejection, acknowledgement, sign-out and identity/access changes remove records. Clearing invalidates in-flight writes to prevent late cache resurrection.

The service worker caches only a public data-free shell and bounded immutable static assets; it excludes authenticated API responses, external tiles, drafts and private media. Private authorized image bytes remain in the encrypted store. Old shell versions are evicted. Browser storage protects against casual cross-account reuse, not a compromised browser origin or device. A temporarily offline tab can read its previously released data until its bounded lease expires; revocation is rechecked on reconnect.

## Residual risks and external checks

Direct public map tiles need a working network and provider availability; they are not offline packages. Browser geolocation quality depends on a real device, permission, environmental conditions, and provider accuracy. Synthetic browser evidence does not establish outdoor arrival reliability. Production MySQL migration and deployment have not been exercised locally. Operators must review asset rights and real-world route safety before a public launch.
