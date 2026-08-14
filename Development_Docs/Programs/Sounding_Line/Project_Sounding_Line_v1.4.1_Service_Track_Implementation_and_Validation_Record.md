---
title: Project Sounding Line v1.4.1 Service Track Implementation and Validation Record
audience: engineering
status: implementation-candidate
canonical_for: sounding-line-v141-service-track-record
last_reviewed: 2026-08-14
---

# Project Sounding Line v1.4.1 Service Track

## Scope

v1.4.1 is the forward, bounded service-track improvement after v1.4 closure.
It does not rewrite the historical v1.4 atomic-cutover deviation. It activates
persistent governed-test identities and a trusted-protected-main qualification
path for both ordinary frozen candidates and narrow verification maintenance.

## Stable governed identity migration

`testing/governed-test-identities.json` is the generated, repository-owned
identity manifest. Every current registry record has a `stableId`, a retained
`legacyTestId`, current source diagnostics, and historical aliases. Registry
generation fails closed if an active source has no manifest entry. The explicit
`sounding-line-id: <stable-id>` marker permits deliberate relocation without
changing semantic identity. The migration generator provides a deterministic
preview/write path and `validate-test-identities.mjs` enforces:

- no missing or duplicate active stable ID;
- no silent disappearance without retirement/supersession;
- no duplicate historical alias or supersession cycle;
- no unknown active suite or P34 replacement identity; and
- stable semantics when source line or formatting changes.

P34 stays archived, historical, nonselectable, and nonauthoritative. Its
replacement test IDs now point to stable current IDs, so line movement is not a
P34 semantic-reconciliation event.

## Trusted-main candidate architecture

`candidate-qualification.mjs` loads the authority index, registry, release
gates, classifier, plan obligations, and finalizer from an authority checkout
whose SHA and tree differ from the frozen candidate's SHA and tree. Each plan
seals authority source SHA/tree, subject SHA/tree, qualified base, optional
predicted integration tree, authority/policy/registry digests, changed paths,
classification, and obligation list. Receipts must repeat that exact binding.

The trusted classifier has four outcomes: `ORDINARY_CANDIDATE`,
`VERIFICATION_MAINTENANCE`, `RECORD_ONLY`, and
`INELIGIBLE_MIXED_SCOPE`. Unknown scope takes the ordinary conservative lane;
a material product path combined with maintenance scope fails closed. A
maintenance finalization produces `MAINTENANCE_GO`; ordinary finalization
produces `RELEASE_GO`. Neither can be produced by candidate-sourced finalizer
code.

## Hosted mechanism

`.github/workflows/sounding-line-candidate-qualification.yml` executes only
from protected main. It separately checks out `main` as `authority` and the
exact candidate SHA as `candidate`, verifies both commit/tree identities,
derives the candidate diff, runs trusted modules with candidate contents as
their working directory, and uploads a sealed plan/finalization artifact. It
retains the one stable job/check name: `Sounding Line / Mainline Decision`.

The Mainline Train preserves its v1.4 tree-binding and policy-drift brakes.
An authority-changing maintenance landing is policy/authority drift and must
brake/replan the affected downstream suffix before it can rely on superseded
authority evidence.

## Emergency boundary and rollback

Administrator bypass is not an ordinary candidate or maintenance path. Any
remaining emergency action is `EMERGENCY_BREAK_GLASS`, solely for a condition
where protected current authority itself cannot execute or cannot publish its
required protected check. Normal stable-ID, registry, fixture, workflow,
planner, finalizer, and P34 repair use governed maintenance. If v1.4.1 fails,
protected history remains intact, qualification fails closed, and the prior
protected-main authority can be verified without a history rewrite.
