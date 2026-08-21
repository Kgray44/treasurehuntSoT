---
title: Project Wakebook Phase 2 Data Quality and Provenance Record
audience: product-engineering
status: draft
canonical_for: project-wakebook-phase-2-data-quality-provenance
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 data quality and provenance

## Quality vocabulary

| Quality          | Meaning                                           | UI behavior                                       |
| ---------------- | ------------------------------------------------- | ------------------------------------------------- |
| `EXACT`          | Immutable or explicitly retained canonical fact.  | Present normally with calm source-aware language. |
| `ESTIMATED`      | Accepted versioned derived measurement.           | Say that the value is approximate.                |
| `UNAVAILABLE`    | History did not retain enough trustworthy detail. | Explain the boundary; do not substitute a value.  |
| `NOT_APPLICABLE` | The fact did not apply to that Voyage.            | Explain only when useful.                         |

## Source classes

Published version, session fact, membership fact, Wayfarer record, artifact
grant receipt, personal artifact record, achievement evidence, owner
annotation, consent record, authorized media reference, and versioned derived
metric are the bounded source classes. Raw TaleSession payloads, secrets,
storage keys, provider evidence, and private Captain notes are never sources
for the DTO.

## Stability rules

Historical title, cover, Creator label, crew labels, edition identity,
artifact-name snapshot, and achievement-definition snapshot remain historical
after current records change. Any intentionally shown current context is an
explicitly labelled separate layer. Provenance is owner-only and contains no
Reflection body, Memory body, authorization material, or raw event data.
