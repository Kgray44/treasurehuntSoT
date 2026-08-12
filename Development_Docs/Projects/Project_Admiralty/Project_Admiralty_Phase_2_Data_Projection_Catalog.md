---
title: Project Admiralty Phase 2 Data Projection Catalog
audience: product-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-data-projections
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 data projection catalog

The machine-readable companion
`Project_Admiralty_Phase_2_Data_Projection_Catalog.json` is the canonical Phase
2 projection inventory. Admiralty consumes bounded typed reads; it does not own
or copy the underlying business truth.

| Port                        | Canonical owner | Administrative use                                              | Maximum data class      | Secret/private exclusions                                                                |
| --------------------------- | --------------- | --------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `WayfarerAdminReadPort`     | Wayfarer        | People search, account dossier, Support Access anchor           | `ACCOUNT_PRIVATE`       | Password/session/OAuth secrets and private profile prose                                 |
| `OneVoyageAdminReadPort`    | One Voyage      | Chronicle, edition, Voyage, crew, and safe event inspection     | `OPERATIONAL_SENSITIVE` | Access tokens, event payloads, variables, inventory, previews, private Chronicle content |
| `HarborlightAdminReadPort`  | Harborlight     | Community listing, release, report, case, and health inspection | `OPERATIONAL_SENSITIVE` | Reporter identity, report prose, moderation evidence bodies, raw manifests               |
| `SealedHoldAdminReadPort`   | Sealed Hold     | Provider, queue, backup, and restore status                     | `OPERATIONAL_SENSITIVE` | Private content, object keys, storage roots, bucket names, keys, job payloads            |
| `SoundingLineAdminReadPort` | Sounding Line   | Current build/release evidence                                  | `OPERATIONAL_SENSITIVE` | Deployment credentials, mutation controls, unverified release claims                     |

Every projection includes state, source, observed time, freshness, environment,
last successful refresh, and a safe failure code. Provider health may use a
30-second process-local optimization; it is neither persistent nor authority.
`SECRET` data is prohibited from all Phase 2 projections.
