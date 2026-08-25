---
title: Project Nightwatch Increment A.1 Atomic Acceptance Sequencer Implementation Record
audience: engineering
status: current
canonical_for: project-nightwatch-increment-a1-atomic-acceptance
last_reviewed: 2026-08-21
---

# Project Nightwatch Increment A.1 - Atomic Acceptance Sequencer

## Scope and boundary

Increment A.1 extends the landed Increment A SQLite ledger with one durable,
exact-identity acceptance transaction per candidate/base. It sequences
reconciliation, focused requalification, candidate freeze, authority,
protected binding, merge, and post-merge identity proof. It does not invoke
Sounding Line, alter branch protection, implement Bosun repair execution, or
begin Nightwatch Increment B.

## Control-plane contracts

- Missing authority is `AWAITING_AUTHORITY`, a neutral pending state.
- Exactly one authority run is recorded per exact candidate/base and exactly
  one binding run per accepted exact candidate/base; duplicate events are no-op
  observations.
- `RELEASE_GO` makes protected binding eligible and `BINDING_PASS` advances to
  merge in the same transaction.
- An `INTEGRATION_ACCEPTANCE` lease begins at candidate freeze and is released
  after exact post-merge proof when still active.
- Main movement after authority is `MERGE_RACE`; it reuses the candidate and
  root cascade rather than manufacturing a successor PR.
- The root fingerprint binds maintenance descendants, authority attempts,
  mainline rebuilds, blocked candidates, elapsed time, and the 30/60/90-minute
  warning/review/breaker policy. A breaker parks new descendant work without
  charging a product failure.

## Bridgewatch projection

`GET /api/nightwatch` now projects current transaction identity, authority and
binding receipt references, lease, semantic invalidation, preserved/rerun
evidence counts, and cascade counters. The Operations station renders those
values read-only and distinguishes pending, blocked, race, and integrated
truth.

## Capability-realization impact

```json
{
  "disposition": "NO_REALIZATION_IMPACT",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": [],
  "potentialLayerImpact": ["STATE", "PROJECTION", "UI"],
  "affectedSurfaces": { "routes": [], "screens": ["Bridgewatch Operations"], "journeys": [], "apis": ["GET /api/nightwatch"] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["unit.nightwatch", "unit.bridgewatch"],
  "rationale": "A.1 is an internal engineering control-plane extension and read-only operational projection; it does not change a product-domain capability, access policy, or user journey."
}
```

## Deferred work

Increment B retains semantic evidence carry-forward contracts and broader
maintenance isolation. Project Bosun repair classification and execution remain
explicitly unimplemented.
