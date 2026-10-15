---
title: SC-00C thousand-Scene rendered Library scale observation
audience: product-engineering
status: local-browser-measurement-pending-final-source
canonical_for: sc-00c-thousand-scene-rendered-library-scale
last_reviewed: 2026-10-15
---

# Thousand-Scene rendered Library scale observation

This [production-browser run](scale-browser-playwright.log.txt) used combined source `a885b6c3481f1f3c93769addf65417f46c53d5c5`, an isolated task-owned SQLite database, a synthetic Creator, and 1,000 minimal saved Scenes with five immutable releases each. The [tracked browser journey](../../../../../../tests/e2e/parallax-sc00c-scale-browser.spec.ts) explicitly requires a fresh database under `artifacts/sc00c/scale-browser`; it is skipped by ordinary suites unless `SC00C_SCALE_BROWSER=1` is set. No private content or shared runtime database was used.

The retained [measurement](browser-scale.json) records one local run:

| Observation | Result |
| --- | ---: |
| Full Studio bootstrap response | 11,995,373 bytes |
| Navigation to visible Parallax heading | 2,429 ms |
| First paged Scene response | 26,345 bytes; 48 cards |
| Search for Scene 0999 through the rendered Library | 420 ms; one match |
| After Show more | 96 cards in the DOM, not 1,000 |
| Phone document width at 390 px | 390 px |

The [desktop](thousand-scenes-desktop.png) and [phone](thousand-scenes-phone.png) screenshots show the actual authenticated Library with the 1,000-item count, bounded cards, source controls and responsive layout. The journey passed **1/1** on Chromium after a task-owned Turbopack production build; full TypeScript and focused ESLint passed. These are single local timings, not network-wide latency guarantees or final-source owner acceptance.

The page itself is compact and searchable, but the default Studio bootstrap still sends all 1,000 full drafts and 5,000 releases. The 2,429 ms navigation includes document load, bootstrap and rendering; it is not solely server execution time. The full response and repeated `load()` callers remain a scale limit. The final combined Community and SC-01 candidate must retain this observation and either remove that full-bootstrap cost or explicitly qualify whole-Studio scale before claiming SC-00C performance acceptance.
