---
title: SC-00C owner catalog page scale observation
audience: product-engineering
status: local-service-pass-pending-combined-integration
canonical_for: sc-00c-owner-catalog-page-scale-observation
last_reviewed: 2026-10-15
---

# Owner catalog page scale observation

This is an isolated, synthetic SQLite service observation for the SC-00C catalog projection. The [measurement](comparison.json) used 1,000 minimal creator-owned Scenes with five immutable releases per Scene. The tracked [probe](../../../../../../scripts/parallax/measure-spatial-catalog-scale.ts) creates a synthetic owner in a fresh, separately bootstrapped database under `artifacts/sc00c/scale`; it rejects a nonempty item table or a database URL outside that directory. No private content was used.

| Read | Local service time | JSON bytes | Returned |
| --- | ---: | ---: | ---: |
| Existing full `spatialLibraryInventory` | 617.86 ms | 11,978,029 | 1,000 drafts and 5,000 releases |
| New first summary page | 70.64 ms | 19,800 | 48 summaries of 1,000 |
| New second summary page | 68.16 ms | 19,800 | 48 summaries |
| New search for last Scene | 61.97 ms | 444 | one summary |
| Exact read of selected Scene | 3.49 ms | 11,959 | working draft and five releases |

The new `pageOwnedSpatialCatalog` reads only version-zero envelopes and release counts, then filters the whole owner catalog before slicing a page. The SC-01 Environment provider may supply authoritative names for parent-Environment search. Its cursor binds the query and an owner-catalog snapshot, so a changed catalog requires a fresh first page. `readOwnedSpatialCatalogItem` loads and validates one selected full record. Both stay under the canonical library owner records; neither changes the save or release mutation authority. Focused tests cover 120-item paging without repeats, far-end and parent-Environment search, archive and favorites, composition classification, owner isolation, stale cursors, working integrity, legacy Environment separation, release binding, and exact-read parity with `listSpatialItems`.

To reproduce, create a **fresh** SQLite file in `artifacts/sc00c/scale`, bootstrap it with `node scripts/sounding-line/sqlite-bootstrap.mjs --database-url file:<absolute-path>`, set `DATABASE_URL` to that same `file:` URL, and run `npx tsx scripts/parallax/measure-spatial-catalog-scale.ts`. The probe writes `artifacts/sc00c/scale/comparison.json`; the checked-in [measurement](comparison.json) is the retained output of this run.

These are single local service timings, not HTTP, React rendering, browser responsiveness, or production latency. The service still scans all working envelopes on each page and has not yet been wired into the shared Studio API or Library host. It handles creator-owned Scenes, Assets, and Compositions; Environment, built-in, installed Community, recently used, and in-use sources remain with their canonical providers. Combined-source browser journeys, protected qualification, and owner acceptance remain pending.
