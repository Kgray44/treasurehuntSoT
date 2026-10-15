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
| Existing full `spatialLibraryInventory` | 672.13 ms | 11,978,029 | 1,000 drafts and 5,000 releases |
| New first owner summary page | 70.35 ms | 24,744 | 48 summaries of 1,000 |
| New globally composed page | 200.19 ms | 26,335 | 48 summaries of 1,000 |
| New second owner summary page | 69.29 ms | 24,744 | 48 summaries |
| New owner search for last Scene | 64.92 ms | 547 | one summary |
| Exact read of selected Scene | 3.02 ms | 11,959 | working draft and five releases |

The new `pageOwnedSpatialCatalog` reads only version-zero envelopes and release counts, then filters the whole owner catalog before slicing a page. The SC-01 Environment provider may supply authoritative names for parent-Environment search. Its cursor binds the query and an owner-catalog snapshot, so a changed catalog requires a fresh first page. `readOwnedSpatialCatalogItem` loads and validates one selected full record. Both stay under the canonical library owner records; neither changes the save or release mutation authority. Focused tests cover 120-item paging without repeats, far-end and parent-Environment search, archive and favorites, composition classification, owner isolation, stale cursors, working integrity, legacy Environment separation, release binding, and exact-read parity with `listSpatialItems`.

To reproduce, create a **fresh** SQLite file in `artifacts/sc00c/scale`, bootstrap it with `node scripts/sounding-line/sqlite-bootstrap.mjs --database-url file:<absolute-path>`, set `DATABASE_URL` to that same `file:` URL, and run `npx tsx scripts/parallax/measure-spatial-catalog-scale.ts`. The probe writes `artifacts/sc00c/scale/comparison.json`; the checked-in [measurement](comparison.json) is the retained output of this run.

The additive Studio `GET` read view accepts `view=library-catalog` with bounded kind, search, source, state, parent Environment, sort, limit and cursor arguments. It merges built-in presets, the existing compatible Environment catalog, optional installed-provider summaries, and creator-owned content **before** global filtering, sorting and page slicing. `view=library-item&entryId=...` reads one exact checked Spatial record or full compatible Environment record. It uses the current Creator session and private no-store response headers; the existing bootstrap and mutation/CSRF routes remain intact. Unsupported Recently Used and In Use requests return an explicit 422 code until all providers expose canonical usage, instead of invented totals. Focused route/projection checks cover global page boundaries and sources, session authority, request bounds, unavailable items, cursor drift and exact record handoff.

These are single local service timings, not HTTP, React rendering, browser responsiveness, or production latency. The owner service still scans all working envelopes on each page. The global projection currently calls the canonical Environment provider, which internally scans complete spatial versions even when no Environment is returned; its 200 ms observation includes that cost. The new read view is not yet used by the shared Studio host, so the default bootstrap still sends the full inventory. SC-01 Manager and SC-07A installed-provider integration, combined-source browser journeys, protected qualification, and owner acceptance remain pending.
