---
title: Project Sounding Line Ordinary Integration Fast Path Amendment
audience: engineering
status: active-mainline
canonical_for: ordinary-integration-fast-path
last_reviewed: 2026-08-24
---

# Project Sounding Line Ordinary Integration Fast Path Amendment

## Decision

ADR-EGS-001 remains unchanged: Sounding Line owns verification truth and
protected-main acceptance; Nightwatch owns scheduling, continuity, delegation,
and integration routing. This amendment removes Mainline Train and full
Baseline Certification as universal ordinary-product prerequisites.

One READY ordinary candidate follows Direct Mainline: exact candidate and
trusted-base binding, semantic-impact selection, mandatory safety sentinels,
fresh required evidence, a Sounding Line decision, protected binding, merge,
and exact landed-tree verification. An unknown impact widens to all ordinary
registered suites; it never narrows evidence.

## Optimization boundary

Mainline Train remains the optional path for multiple compatible candidates.
If its preparation or authority result rejects for an optimization reason,
Nightwatch records that result and dispatches exactly one fresh
`SAFE_DIRECT_FALLBACK` authority run. The fallback reuses no speculative Train
evidence and binds the same exact candidate, base, and tree.

Ordinary work does not repair an optimizer defect after the one allowed
independent shared repair. It takes the fallback; only a failure of the
correctness path itself is a control-plane blocker.

## Auxiliary boundaries

Baseline Certification remains required for release, control-plane, break-glass,
scheduled, and explicitly repository-wide operations, but is not a normal
ordinary-merge prerequisite. Deepwater is required only when capability
realization or reachability materially changes. Generated feature-catalog
meaning is still candidate-time work; generated commit and landed-SHA
provenance is reconciled after protected landing.

Derived records declare their generator, semantic inputs, and outputs in
trusted policy. Candidate-caused semantic generated-state drift remains a
candidate blocker. A deterministically regenerated record-only output is
recorded as asynchronous nonblocking reconciliation even when a candidate
touches its inputs; its full path remains bound while only declared record-only
outputs are excluded from semantic impact selection.

Trusted project ownership can declare bounded helper paths. A helper is
ordinary-admissible only with its correlated owned test in the same candidate;
unowned and sensitive executable surfaces remain fail-closed.

## Preserved limits

Release candidates retain exhaustive repository proof. Sounding Line retains
exact candidate, base, tree, and protected bindings, anti-self-authorization,
and fail-closed unknown-impact behavior. This amendment adds no authority and
does not create auto-merge.

## Evidence

- `src/nightwatch/controller.ts` routes one compatible candidate to Direct
  Mainline, multiple candidates to Train, and a rejected Train to Safe Direct
  Fallback.
- `.github/workflows/sounding-line-authoritative.yml` accepts the direct or
  fallback verification route without a Baseline Certification input.
- `tests/sounding-line/v14/ordinary-integration-fast-path.test.mjs` and
  `src/nightwatch/controller.test.ts` cover conservative fallback, the repair
  ceiling route, and ordinary direct routing.
- `scripts/sounding-line/generated-state-attribution.mjs` distinguishes
  candidate-caused generated drift from pre-existing unrelated generated state.

## Limitation

Harborlight acceptance remains separately subject to the independent Sounding
Line decision, protected binding, and exact landed-tree verification.
