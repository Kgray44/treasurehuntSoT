---
title: SC-00C rendered Library scale observations
audience: product-engineering
status: local-browser-measurement-pending-final-source
canonical_for: sc-00c-thousand-and-two-thousand-scene-rendered-library-scale
last_reviewed: 2026-10-15
---

# Rendered Library scale observations

This [production-browser run](scale-browser-playwright.log.txt) used combined source `a885b6c3481f1f3c93769addf65417f46c53d5c5`, an isolated task-owned SQLite database, a synthetic Creator, and 1,000 minimal saved Scenes with five immutable releases each. The [tracked browser journey](../../../../../../tests/e2e/parallax-sc00c-scale-browser.spec.ts) explicitly requires a fresh database under `artifacts/sc00c/scale-browser`; it is skipped by ordinary suites unless `SC00C_SCALE_BROWSER=1` is set. No private content or shared runtime database was used.

The retained [measurement](browser-scale.json) records one local run:

| Observation                                        |                         Result |
| -------------------------------------------------- | -----------------------------: |
| Full Studio bootstrap response                     |               11,995,373 bytes |
| Navigation to visible Parallax heading             |                       2,429 ms |
| First paged Scene response                         |         26,345 bytes; 48 cards |
| Search for Scene 0999 through the rendered Library |              420 ms; one match |
| After Show more                                    | 96 cards in the DOM, not 1,000 |
| Phone document width at 390 px                     |                         390 px |

The [desktop](thousand-scenes-desktop.png) and [phone](thousand-scenes-phone.png) screenshots show the actual authenticated Library with the 1,000-item count, bounded cards, source controls and responsive layout. The journey passed **1/1** on Chromium after a task-owned Turbopack production build; full TypeScript and focused ESLint passed. These are single local timings, not network-wide latency guarantees or final-source owner acceptance.

A later fresh isolated database contained **2,000** minimal saved Scenes and 10,000 immutable releases. The [production Chromium journey](two-thousand-browser-pass.log.txt) passed **1/1** using the same committed source and production build. The [desktop](two-thousand-scenes-desktop.png), [phone](two-thousand-scenes-phone.png), [210 px panel](two-thousand-scenes-narrow-panel.png), and [420 px panel](two-thousand-scenes-wide-panel.png) screenshots show the rendered Library. Its [measurement](two-thousand-browser-scale.json) records:

| Observation                                        |                                                     Result |
| -------------------------------------------------- | ---------------------------------------------------------: |
| Full Studio bootstrap response                     | 23,990,373 bytes, measured by a repeated authenticated GET |
| Navigation to visible Parallax heading             |                                                   3,149 ms |
| First paged Scene response                         |                                     26,345 bytes; 48 cards |
| Search for Scene 1999 through the rendered Library |                                          974 ms; one match |
| After Show more                                    |                             96 cards in the DOM, not 2,000 |
| Keyboard inspection and panel resize               |                    Enter opened details; 210–420 px limits |
| Phone document width at 390 px                     |                                                     390 px |

The first [2,000-item attempt](two-thousand-body-eviction-attempt.log.txt) reached the visible Studio heading, then its byte measurement failed because Chromium evicted the 24 MB response body from the DevTools inspection cache. The passing run measured bytes with a separate authenticated API read after recording the heading-visible time; its byte count is not the original navigation response body. Both attempts used fresh databases, and the first failure is an instrumentation limit rather than a product assertion failure.

The Library catalog itself is compact and searchable, but the default Studio bootstrap sends all full drafts and releases: 1,000/5,000 in the first case and 2,000/10,000 in the second. Heading-visible navigation includes document load, bootstrap and rendering; it is not solely server execution time. The full response roughly doubled with the fixture and remains a scale limit. The final combined Community and SC-01 candidate must retain this observation and either remove that full-bootstrap cost or explicitly qualify whole-Studio scale before claiming SC-00C performance acceptance.
