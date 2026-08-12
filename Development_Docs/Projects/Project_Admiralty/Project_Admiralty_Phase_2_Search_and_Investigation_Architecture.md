---
title: Project Admiralty Phase 2 Search and Investigation Architecture
audience: product-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-search-investigation
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 search and investigation architecture

## Search domains and keys

| Domain        | Allowed keys                                                        | Required capability                       | Result bound  |
| ------------- | ------------------------------------------------------------------- | ----------------------------------------- | ------------- |
| People        | display name, exact email, stable account ID                        | `ACCOUNT_OBSERVE`                         | 25            |
| Chronicles    | title, stable Chronicle ID                                          | `CHRONICLE_OBSERVE`                       | 30            |
| Voyages       | title, stable Voyage ID, Chronicle relationship                     | `VOYAGE_OBSERVE`                          | 30            |
| Community     | listing title, slug, stable listing ID                              | `COMMUNITY_OBSERVE`                       | 30            |
| Audit         | action, category, actor/target/correlation ID, bounded time window  | `AUDIT_OBSERVE`                           | 100           |
| Investigation | exact or prefix correlation ID across safe audit and event evidence | `PLATFORM_OBSERVE`, with domain filtering | 50 per source |

Queries are trimmed, case-normalized by the canonical database collation where
available, limited to 96 characters, and ignored below two meaningful
characters. Page numbers are bounded to 1–50. Search never becomes an
unbounded people directory, raw database browser, or arbitrary query surface.

## Authorization, privacy, and indexing

The server authorizes every domain before executing its query and removes
unavailable domains from federated results. Result objects are typed safe
projections, never Prisma objects. Searches use existing canonical indexed
identifiers and bounded database predicates; Phase 2 creates no persistent
index, snapshot, or second source of truth. `SECRET` and private content fields
are excluded before projection.

Search and dossier reads are rate limited per current session/operator. Stable
IDs are secondary technical details with accessible copy controls; normal
results lead with human names, titles, and states.

## Correlation and partial results

Investigation accepts a bounded correlation identifier and follows only
canonical evidence that the operator may already observe. It does not infer a
relationship merely because two records share text. Each result names its
source, timestamp, type, and safe summary. Correlation discovery does not grant
access to an otherwise unauthorized account, Chronicle, Voyage, Community, or
audit domain.

Federated search is partial-result tolerant. A failing or unauthorized owner
domain returns an explicit unavailable/omitted state while other domains stay
usable. Stale evidence remains labeled `STALE`; it is never represented as live
or healthy. Safe error codes may be displayed, but raw exceptions, queries,
payloads, and credentials are not.
