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

The offline cache is bound to the current session, published version, and CSRF identity. It expires after 30 minutes and holds only released data. Pending evidence is tab memory, bounded to one item, and is never treated as a canonical visit until the server accepts it. Reconnect rechecks the current sequence and version; stale evidence fails closed. The shell service worker excludes authenticated API responses, tiles, media, and drafts.

## Residual risks and external checks

Direct public map tiles need a working network and provider availability; they are not offline packages. Browser geolocation quality depends on a real device, permission, environmental conditions, and provider accuracy. Synthetic browser evidence does not establish outdoor arrival reliability. Production MySQL migration and deployment have not been exercised locally. Operators must review asset rights and real-world route safety before a public launch.
