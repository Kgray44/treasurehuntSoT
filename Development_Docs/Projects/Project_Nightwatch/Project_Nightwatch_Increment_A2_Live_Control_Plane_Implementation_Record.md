---
title: Project Nightwatch Increment A.2 Live Control Plane Implementation Record
audience: engineering
status: current
canonical_for: project-nightwatch-increment-a2-live-control-plane
last_reviewed: 2026-08-21
---

# Project Nightwatch Increment A.2 - Live Control Plane

## Scope and boundary

Increment A.2 commissions the durable `nightwatchd` integration controller.
It owns one controller lease, durable recovery from the local Nightwatch ledger,
exact GitHub workflow dispatch and rediscovery, RELEASE_GO-gated protected
binding, controlled protected merge, and exact landed-tree proof. It does not
create product work, claim Sounding Line authority, weaken branch protection,
or implement Bosun repair execution.

## Live controller contract

- The controller writes its dispatch intent before calling GitHub and binds the
  exact external run ID afterward. A restart rediscovers the run by the durable
  dispatch key rather than dispatching an equivalent workflow again.
- Ordinary pull-request events are classification/preflight only. They cannot
  initiate record-only finalization or protected binding.
- Sounding Line authority is explicitly dispatched with the exact PR, frozen
  candidate SHA/ref, and qualified base. A successful workflow is insufficient:
  the controller reads the finalization artifact and requires `RELEASE_GO`.
- The protected-binding dispatch accepts exact PR/candidate/ref/base/authority
  identifiers, verifies the synthetic merge identity, and emits a receipt that
  must contain `BINDING_PASS` before controlled merge is requested.
- Controller health is stored in the ledger, guarded by a renewable controller
  lease, and projected read-only in Bridgewatch. The lifecycle helper refuses
  to stop an unowned process.

## Cost and cascade guard

The parent cost ledger persists elapsed wall time, product value, control-plane
active/wait, external-blocked, maintenance, authority, browser, and retry time,
plus remaining closure steps. Standard 30/60/90-minute warning, hard-review,
and breaker thresholds cannot be reset by a SHA, PR, worktree, or restart.
At the hard review the controller does not dispatch new authority or binding;
at the breaker it parks the transaction, releases the acceptance lease, and
requests cancellation for a controlled active workflow. The minimal Bosun seam
deduplicates an equivalent finding within the parent cascade and rejects new
descendants at review/breaker or generation greater than two.

## Operations and evidence

- `npm run nightwatch:controller:start|stop|status|restart` manages only the
  owned controller process and local ledger.
- `GET /api/nightwatch` and Bridgewatch Operations expose controller liveness,
  transaction identity, exact run references, remaining closure steps, and raw
  cost values without mutation controls.
- Focused tests cover persistent controller ownership, dispatch-intent recovery,
  authority-before-binding sequencing, receipt-gated acceptance, 30/60/90
  thresholds, cascade deduplication, and read-only Bridgewatch projection.

## Capability-realization impact

```json
{
  "disposition": "CHANGES_EXISTING_CAPABILITY",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": ["FT-B012"],
  "potentialLayerImpact": ["STATE", "SERVICE", "PROJECTION", "UI"],
  "affectedSurfaces": {
    "routes": [],
    "screens": ["Bridgewatch Operations"],
    "journeys": [],
    "apis": ["GET /api/nightwatch"]
  },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["unit.nightwatch", "unit.bridgewatch", "workflow.sounding-line"],
  "rationale": "A.2 materially extends the existing Nightwatch operational capability with a persistent controller and read-only health/cost truth; it does not change product-domain access, user journeys, or RELEASE_GO authority."
}
```

## Deferred work

Increment B remains responsible for broader Sounding Line evidence
carry-forward and maintenance isolation. Bosun repair execution, fleet work,
and product scope remain explicitly outside A.2.
