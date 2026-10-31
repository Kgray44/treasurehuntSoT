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

## Root integration corrections

Root `71c8c7d3` adopts the additive service and API source while keeping the full
client bootstrap unchanged. Independent technical review found two server-page
gaps: the ordinary HTTP call omitted the implemented SC-02 provider registry, and
composition tags could override explicit Scene metadata. The corrected read
projection always merges the actual implemented physical/effect/composition
registry before global filtering and paging, including when no provider argument
is passed. Explicit Library type now wins in both full and compact catalog paths;
tagged templates without explicit Scene metadata remain compositions. This also
corrects the earlier root compatibility rule, which could misclassify a legitimate
Save As Scene that retained template tags. No stored record is rewritten.

The original 49-check/four-file root run and the repaired 51-check/four-file run
remain separate evidence. New regressions cover real built-ins without manual
provider injection and explicit Scene classification. Independent source re-review
resolves `PX-CATALOG-PROVIDERS-01` and `PX-CATALOG-KIND-01` against read-projection
SHA256 `65ee0cf8714bb67a6186eac87a166d5edfb4d07dda4fbc00e99b4340f35aee5b`,
page-service `eec9312cbecc955e90b040eeb18fd92a599fc3f394d0015a0f5569f699868904`
and shared catalog `bfeb216c2bdd1ecb70d1a126de701a98ee373695dccd762a2025b555977c4871`.
The reviewer inspected source and supplied logs without executing the checks.
The combined root also passes full TypeScript and changed-source lint.

The earlier measurement above retains its exact original source and provider set;
it is not a benchmark of this later root correction. Installed Community summary
provenance and exact read-only handling remain separately owned integration work.
The Library host switch is held until that seam is connected. These repairs do not
qualify completed browser scalability or Community publication/install behavior.
