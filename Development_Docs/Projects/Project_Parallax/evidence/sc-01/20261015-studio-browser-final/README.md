---
title: SC-01 normal and adverse browser handoff
audience: product-engineering
status: supporting-evidence
canonical_for: parallax-sc01-studio-browser-final-20261015
last_reviewed: 2026-10-15
---

# Four passing consumer journeys

[The receipt](run.json) binds four passing production-browser journeys to 66ff1dbc and tree a693aa43. The actual recordings, images, immutable reference export and helper/build receipts retain their hashes. Product runtime, lockfile, Next configuration and Prisma are byte-identical to the preceding normal-journey PASS source b717de17.

The fourth case simulates exactly one transport 503. It proves the actual Manager's visible error, unchanged server draft/revision and successful live retry to the same identity and next CAS. It does not represent a real backend outage. The earlier ordinary request-limit failure remains recorded separately, and production limits remain unchanged.

The [Environment impact capture](sc01-integrated-environment-impact.png), [first mobile gallery view](sc01-integrated-gallery-phone.png), [letter mobile card](sc01-integrated-letter-card-phone.png), [save error](sc01-integrated-save-error.png) and [recovery](sc01-integrated-save-recovered.png) show the bounded states. [The reference example](chronicle-scene-reference-example.json) retains every immutable Scene and Environment pin for the future Chronicle consumer.

Subsequent root Inspector, paged Library and installed read-only changes require their own integration checks. Independent combined review, protected qualification, mainline integration and landed smoke remain pending. All earlier failures and review identities are preserved; no review budget is reset and no physical or owner acceptance is claimed.
