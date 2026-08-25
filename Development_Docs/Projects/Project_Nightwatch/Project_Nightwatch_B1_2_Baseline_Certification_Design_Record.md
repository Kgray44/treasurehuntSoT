---
title: Project Nightwatch and Bosun B1.2 Baseline Certification Design Record
audience: engineering
status: current
canonical_for: project-nightwatch-bosun-b1-2-baseline-certification
last_reviewed: 2026-08-21
---

# Project Nightwatch and Bosun B1.2 - Baseline Certification

## Scope

B1.2 adds a deterministic, protected-main Baseline Certification before an
ordinary candidate can dispatch expensive Sounding Line authority. The receipt
binds its protected-main SHA and tree, every performed check, all normalized
failure fingerprints, AUTO_0 repairability, non-AUTO_0 blockers, closure
dependencies, and timestamp.

The certifier runs the shared deterministic prerequisites together: Sounding
Line inventory and policy, P34 retirement records, active registry, Ledgerlight
index, Feature Catalog, Deepwater source-policy projections, migration
inventory, protected-binding route availability, and runtime identity. It
collects every failure in one pass. Generator checks execute twice and reject
nondeterminism or paths outside their declared output set.

Nightwatch validates the receipt twice: its GitHub transport refuses authority
dispatch without one successful exact-base receipt, and the trusted authority
workflow independently downloads and verifies the same receipt before planning
candidate work. A protected-main change therefore makes certification stale by
identity rather than allowing an old receipt to carry forward.

## Compound closure boundary

The initial protected-main scan found deterministic generated drift in P34,
the active registry, Ledgerlight documentation projection, Feature Catalog,
and Deepwater policy projection. They are one legally co-locatable AUTO_0
closure set, not separate discovery PRs. No product/canary authority is used
to diagnose them. Non-AUTO_0 findings remain explicit in the receipt and stop
the flow without being silently converted into repair authority.

## Non-goals

- This does not restart PR #404 or start candidate authority.
- This does not resume Wakebook, Confluence, the product fleet, AUTO_1, or B2.
- Sounding Line remains the only issuer of `RELEASE_GO`; B1.2 only supplies an
  earlier shared-baseline prerequisite.

## Deepwater capability-realization impact

```json
{
  "disposition": "CHANGES_EXISTING_CAPABILITY",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": ["FT-B012"],
  "potentialLayerImpact": ["STATE", "SERVICE", "PROJECTION"],
  "affectedSurfaces": { "routes": [], "screens": ["Bridgewatch Operations"], "journeys": [], "apis": ["GET /api/nightwatch"] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["unit.nightwatch", "unit.sounding-line", "workflow.sounding-line"],
  "rationale": "B1.2 materially expands the existing Nightwatch and Bosun control plane with exact-main shared-baseline certification and compound deterministic closure, without adding a product-domain capability or user access path."
}
```
