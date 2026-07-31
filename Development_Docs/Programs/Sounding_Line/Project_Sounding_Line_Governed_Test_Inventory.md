---
title: Project Sounding Line Governed Test Inventory
audience: engineering
status: current
last_reviewed: 2026-07-30
---

# Project Sounding Line Governed Test Inventory

The canonical machine inventory is `testing/generated/active-test-registry.json`.
It contains 1,267 active case definitions in schema 2.0.0. Each row records a
stable ID, source identity, owner, family, protected contracts, isolation,
browser/device policy, positive and negative coverage declarations, relevance
classifications, duration/budget, gates, aliases, and current status.

The inventory is regenerated before validation. `node scripts/sounding-line/cli.mjs
inventory --completeness` reconciles executable discovery against family
ownership; unregistered or stale definitions fail policy.
