---
title: Sounding Line v1.4 product verification registration admission record
audience: engineering
status: implementation
canonical_for: sounding-line-v14-product-verification-registration-admission
last_reviewed: 2026-08-18
---

# Sounding Line v1.4 product verification registration admission

## Purpose

This bounded correction resolves a generic v1.4 admission deadlock: a product
candidate may need to register contracts, impact coverage, owned suite coverage,
a Playwright project, and the generated test registry before the authoritative
workflow can plan the required product proof. Those product-owned registrations
are not themselves a change to Sounding Line release authority.

The correction adds the explicit ordinary-candidate classification
`PRODUCT_WITH_VERIFICATION_REGISTRATION`. It is not a maintenance decision, a
`RELEASE_GO`, a finalizer path, or a protected-merge bypass.

## Trusted boundary

The candidate classifier is always read from the exact trusted protected base.
For a registration candidate it compares trusted-base and candidate snapshots of
contracts, impact mappings, suites, file dispositions, active test registry,
ownership, Playwright configuration, and the registry generator source.

Admission requires all of the following:

- a real source change for exactly one trusted ownership project, selected by
  the authority of newly registered contracts;
- unchanged existing contracts and no deletion of contracts, mappings, suites,
  dispositions, or unrelated generated registrations;
- only monotonic extension of that project's contracts and suites;
- only explicitly configured shared verification suites for product records;
- a new Playwright project bound to an owned browser registry case;
- unchanged protection for authority files, unknown paths, mixed authority
  diffs, and empty diffs; and
- deterministic regeneration of the committed active registry before planning.

An already trusted discovery descriptor may supply the same owner shape for a
future discovered project. This correction neither implements discovery nor
trusts a descriptor supplied by an untrusted candidate.

## Candidate and train consistency

Both ordinary candidate qualification and Mainline Train admission invoke the
same `verification-maintenance.mjs ordinary` classifier. The train no longer
has an independent inline glob implementation. A rejected product-registration
shape fails before workers or any finalizer receive a plan.

## Explicit non-goals

This change does not modify Wakebook product behavior, specialize policy for
Wakebook, alter ownership registry mutation rules, modify planner/finalizer or
`RELEASE_GO` semantics, change protected-binding requirements, or dispatch an
ordinary product authority run.

## Preserved historical evidence

The unmodified Wakebook Phase 2 candidate
`68b97020a45f6c2cef0a8afb5b0b89a077c21641`, compared to its preserved base
`fc39942a1d8fe57fc13f35cae01445e704b94c45`, classifies as
`PRODUCT_WITH_VERIFICATION_REGISTRATION` with no classifier errors under this
new policy. That is read-only policy evidence, not Wakebook acceptance,
qualification, merge, or an authority decision.

## Qualification and integration state

Implementation-level qualification records the focused classifier, train,
policy, registry-generation, static, documentation, privacy, and workflow
checks against the eventual frozen policy candidate. Because this record changes
authority-sensitive admission code and policy, it must itself reach protected
main only through the current self-modification authority process.
