---
title: Project Nightwatch Increment A Implementation Record
audience: engineering
status: current
canonical_for: project-nightwatch-increment-a-runtime
last_reviewed: 2026-08-20
---

# Project Nightwatch Increment A - Order the Fleet

## Scope and boundary

Increment A implements the durable Nightwatch control-plane foundation. It is
an engineering-runtime capability, not a product-domain mutation surface. The
runtime adds no Prisma schema, does not invoke Sounding Line, does not perform
GitHub interaction, and does not implement the Project Bosun repair engine.

The delivered source is `src/nightwatch/runtime.ts`. Its local state defaults
to the untracked `.nightwatch/nightwatch.sqlite` ledger. The ledger stores only
opaque engineering identifiers, lifecycle transitions, queue metadata,
reservation ranges, leases, and auditable event payloads. It rejects fields and
values that look like credentials or bearer tokens; no user, chat, or private
product content is accepted.

## Runtime contracts

- Product candidates move through the governed lifecycle with explicit
  transition validation. Illegal moves fail closed.
- The database-level active-candidate index permits one active candidate for an
  objective. A deliberate successor supersedes the prior candidate and retains
  its terminal reason and lineage.
- Queue entries retain project, increment, branch, product/base SHA, ready
  time, priority, dependencies, reservation references, ownership classes,
  blockers, focused evidence references, risk, downstream-unblock value, and
  queue history.
- Ordering is deterministic. Priority is tempered by age, then migration
  ordering, downstream unblock value, risk, size, timestamp, and stable ID.
  Age eventually outweighs priority, so a smaller eligible candidate cannot be
  starved permanently by a newer large one.
- Only the selected queue front may acquire an Integration Acceptance lease and
  begin reconciliation. A `MAIN_ADVANCED` event records movement without
  waking or rebasing non-front candidates.
- A blocked front records its blocker and can yield to a separately eligible
  candidate without erasing its history. Dependency candidates remain ineligible
  until their declared candidate dependencies have post-merge proof.
- Migration reservation allocation is transactional and rejects active range
  overlaps. It supports multi-ID ranges, release, expiry, recovery, repository
  family inspection, and fails safely when a known migration family is
  ambiguous. Current SQLite timestamp-prefix and MySQL numeric-prefix families
  are inspected rather than assumed.
- Leases have explicit type, scope, owner, expiry, state, and audit events.
  Overlapping active leases fail closed; restart recovery expires stale leases
  and reservations without silently renewing them.

## Supported interface

The supported developer interface is intentionally narrow:

```text
npm run nightwatch:migrations:reserve -- sqlite <project> <objective> <count> [task-ledger.sqlite]
npm run nightwatch:migrations:inspect -- [task-ledger.sqlite]
npm run nightwatch:migrations:release -- <reservation-id> <owner> [task-ledger.sqlite]
npm run nightwatch:migrations:reconcile
npm run nightwatch:projection
```

Direct `tsx scripts/nightwatch/cli.ts` use also accepts named options. Positional
arguments keep the supported npm interface stable on Windows hosts that consume
unknown `--flag` values before forwarding them to a package script.

The MySQL family is currently reported as ambiguous because repository history
contains duplicate numeric prefixes. Reservation allocation therefore rejects
that family rather than guessing a next number.

## Bridgewatch projection

Bridgewatch reads the ledger through `bridgewatch/src/nightwatch-projection.ts`
and exposes it at `GET /api/nightwatch`; it has no Nightwatch mutation route.
The projection returns candidate lifecycle and age, full queue state and
blockers, queue-front identity, migration reservations and discovered
collisions, lease and acceptance ownership, and current integration lifecycle.
An absent or malformed local ledger reports `UNAVAILABLE` or `DEGRADED` without
creating or modifying it.

## Capability-realization impact

```json
{
  "disposition": "NO_REALIZATION_IMPACT",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": [],
  "potentialLayerImpact": ["STATE", "PROJECTION"],
  "affectedSurfaces": { "routes": [], "screens": [], "journeys": [], "apis": ["Bridgewatch GET /api/nightwatch"] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["unit.nightwatch", "unit.bridgewatch"],
  "rationale": "Increment A is an internal engineering control plane and read-only Mission Control projection. It does not alter a user-facing product capability, ownership, access, or journey."
}
```

## Deferred work

Increment B remains responsible for Sounding Line maintenance isolation and
generated-artifact qualification boundaries. Project Bosun's finding,
classifier, detector, repair, and mutation execution phases remain unimplemented.
Sounding Line is still the sole `RELEASE_GO` and protected-merge authority, and
Fairlead remains the sole GitHub interaction authority.
