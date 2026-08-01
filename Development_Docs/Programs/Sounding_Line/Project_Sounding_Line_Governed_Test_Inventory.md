---
title: Project Sounding Line Governed Test Inventory
audience: engineering
status: current
last_reviewed: 2026-07-31
---

# Project Sounding Line Governed Test Inventory

The canonical machine inventory is `testing/generated/active-test-registry.json`.
It contains 1,270 active case definitions in schema 2.0.0 across 39 owned
active families. Each row records a stable ID, source identity, owner, family,
protected contracts, isolation, browser/device policy, coverage declarations,
duration/budget, gates, aliases, and current status.

The 16 release-candidate browser families own 325 active cases. Hosted
release-candidate run `30691520484` discovered and executed all 325, with 325
passes and no failures or skips. Per-family reconciliation is canonical in
`Project_Sounding_Line_Final_Browser_Closure_Ledger.csv`.

Inventory generation and validation are fail-closed. `node
scripts/sounding-line/cli.mjs inventory --completeness` reconciles executable
discovery against family ownership; unregistered, stale, duplicated, or P34
selection fails policy.
