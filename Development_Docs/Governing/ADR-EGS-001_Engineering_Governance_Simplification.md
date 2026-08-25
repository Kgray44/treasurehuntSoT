---
title: ADR-EGS-001 Engineering Governance Simplification
audience: engineering
status: current
canonical_for: engineering-governance-simplification
last_reviewed: 2026-08-23
---

# ADR-EGS-001: Engineering Governance Simplification

## Decision

Engineering governance has two authorities. Sounding Line owns verification,
`RELEASE_GO`, and protected acceptance. Nightwatch owns readiness, priority,
dependencies, Mainline Train admission, resource reservations, budgets, loop
containment, and observation. Bosun is a Nightwatch maintenance executor, not
an approval authority. Project Trim supplies context; Fairlead transports
GitHub operations; Bridgewatch remains read-only.

The active machine-readable implementation is
[`testing/engineering-governance-policy.json`](../../testing/engineering-governance-policy.json).
It is deliberately a bounded cutover, not a new program or a Sounding Line
version increment.

## Classification and acceptance

| Class | Use | Acceptance rule |
| --- | --- | --- |
| `ORDINARY` | Product, docs, tests, declarations, deterministic shared maintenance, and bounded Bosun repair | Sounding Line Mainline Train; impact-selected proof; `RELEASE_GO` only from Sounding Line |
| `CONTROL_PLANE_CHANGE` | Sounding Line/Nightwatch authority, policy, workflow, or admission semantics | Explicit repository-owner dispatch, trusted-base classification, conservative affected-control-plane proof, exact candidate/base/landed-tree binding, then normal protected merge |
| `BREAK_GLASS` | A non-product repair when the trusted control path cannot process it | Explicit owner authorization, exact scope, expiry, before/after evidence, and post-recovery normal-path self-verification |

Candidate-owned policy never authorizes its own control-plane change. Unknown
paths remain fail-closed. Release-candidate validation remains exhaustive.

## Ordinary flow

`Project Trim -> focused development proof -> READY -> Nightwatch scheduling ->
Sounding Line Mainline Train -> impact-selected authoritative proof -> protected
merge -> landed-tree verification -> DONE`

The Mainline Train is the ordinary integration default. It preserves frozen
candidate identity, deterministic/fair ordering, dependency and migration
brakes, predicted trees, parallel isolated proof, evidence invalidation,
bounded suffix replanning, protected binding, and actual landed-tree equality.
Nightwatch observes Sounding Line decisions; it does not reinterpret test
sufficiency, evidence validity, release correctness, or `RELEASE_GO`.

Normal test additions use the declarative interface in
`testing/test-registrations/`. Sounding Line validates ownership, contracts,
suite binding, stable test identity, adapter, resources, parallel safety, and
release relevance while generating the effective test inventory. A malformed
or unmapped declaration fails closed with a precise error.

Feature Catalog, Deepwater, document indexes, and changelog/user-document work
are impact-selected. An ordinary protected merge is closure; it does not create
a human-managed record-only follow-up PR.

## Compatibility and retirement

The former Verification Maintenance, Authority Maintenance, and Root
Maintenance lanes remain only as compatibility adapters while the protected
cutover is observed. They have no independent product authority, accept no new
normal callers, and are retired once this model self-verifies on protected
main. Historical documents remain preserved; their former operational role is
superseded by this ADR and the active machine-readable policy.

## Safety invariants

- `Sounding Line / Mainline Decision` remains the protected-main authority.
- Raw tests, hosted evidence, Bosun, and Nightwatch never authorize a merge.
- Exact candidate, trusted-base, predicted-tree, and landed-tree identities are
  bound and checked.
- Unknown impact expands conservatively instead of being optimized away.
- Release candidates remain exhaustive even though ordinary merges are
  impact-selected.
