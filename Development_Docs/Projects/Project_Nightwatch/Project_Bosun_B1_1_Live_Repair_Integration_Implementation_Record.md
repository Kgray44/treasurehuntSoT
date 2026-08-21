---
title: Project Bosun B1.1 Live Repair Integration Implementation Record
audience: engineering
status: current
canonical_for: project-bosun-b1-1-live-repair-integration
last_reviewed: 2026-08-21
---

# Project Bosun B1.1 - Live Repair Integration

## Scope and boundary

B1.1 connects one already-focused `AUTO_0` repair candidate to the existing
Nightwatch atomic acceptance path. It does not start Bosun B2/AUTO_1, alter
product behavior, weaken Sounding Line authority, or permit manual product
fleet repair.

## Control-plane contract

- An attached repair retains the parent transaction's integration cascade and
  cumulative cost ledger; a new repair SHA or restart cannot create a new
  budget.
- One canonical repair candidate becomes the only queue-front candidate while
  the parent remains durably `SHARED_BLOCKED`.
- The ordinary Nightwatch path retains responsibility for exact authority
  dispatch, `RELEASE_GO`, protected binding, `BINDING_PASS`, merge, and exact
  protected-main tree verification.
- Bosun records the repair PR, candidate/base identity, deterministic action
  digest, and focused evidence before final authority dispatch.
- A Bosun repair converges only after post-merge proof reports the root blocker
  removed. Dependents resume through the normal queue method, which clears
  their original blocker; the durable wakeup receipt prevents replayed wakes.

## Deepwater capability-realization impact

```json
{
  "disposition": "CHANGES_EXISTING_CAPABILITY",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": ["FT-B012"],
  "potentialLayerImpact": ["STATE", "SERVICE", "PROJECTION"],
  "affectedSurfaces": { "routes": [], "screens": ["Bridgewatch Operations"], "journeys": [], "apis": ["GET /api/nightwatch"] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["unit.nightwatch", "unit.bridgewatch", "workflow.sounding-line"],
  "rationale": "B1.1 materially completes the existing Bosun/Nightwatch maintenance control plane, but does not add a product-domain capability, user access path, or journey."
}
```

## Focused evidence

`src/nightwatch/bosun.test.ts`, `src/nightwatch/controller.test.ts`, and
`src/nightwatch/runtime.test.ts` prove candidate identity persistence, one
authority and binding path, restart-safe convergence, exact post-merge proof,
and two dependent wakeups.
