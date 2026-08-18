---
title: Sounding Line v1.4.2 Shipwright Owner Materialization Record
audience: engineering
status: pending-authority-maintenance
canonical_for: sounding-line-v1.4.2-shipwright-owner-materialization
last_reviewed: 2026-08-18
---

# Shipwright trusted-owner materialization

## Base and root cause

This authority-maintenance candidate starts from protected main
`c70428e8dfc60a37a98a0c1fdf1dd474c7dbaeae`.

v1.4.2 correctly added a source-bound `project-shipwright` discovery record,
but static policy continued to use only `testing/ownership.json`. A legitimate
Phase 3 registration could therefore resolve the descriptor in the ordinary
classifier but fail static validation because its owner was not in that older
registry. Its shared Prisma schema paths also matched the accepted Tideglass
owner, which was not listed as an allowed Shipwright supporting owner.

The correction is generic: `scripts/sounding-line/project-discovery.mjs`
materializes deterministic static owner identities from the trusted discovery
registry, and `scripts/sounding-line/cli.mjs` validates references against that
effective trusted-owner set. It does not read candidate paths, create a
Shipwright-specific classifier branch, or alter ordinary-candidate distrust of
candidate discovery/ownership changes.

## Trusted accepted-main evidence

The source-bound discovery entry retains only accepted Shipwright Phase 1/2
records, the accepted Feature Catalog entry, bounded Creator Studio source and
test paths, and aliases `Shipwright` and `Project Shipwright`. Its static owner
identity is exactly:

- `id` and project identity: `project-shipwright`;
- source paths: the existing bounded Creator Studio paths in the trusted
  descriptor;
- test paths: the existing accepted Shipwright test paths in the descriptor;
- contracts: none newly invented;
- supporting owners: Drydock, One Voyage, Platform Foundation, and Tideglass.

Tideglass is a supporting owner only for the already accepted shared Prisma
schema ownership. Shipwright gains no Tideglass source ownership, no broad
`src/**`, API, script, Creator Studio, or Sounding Line authority ownership.

## Regression proof and boundary

The focused discovery regression proves deterministic materialization, no
unrelated owner materialization, and no broadening of the Shipwright source or
test paths. Existing v1.4 tests continue to prove that candidate-supplied
descriptors cannot establish trust and that ambiguous/unknown projects remain
conservative.

The preserved PR #194 fixture remains read-only for this authority candidate.
Its historical base `c568e5aa15df4d8b682e328d97fa1a78b7b5760a` and head
`a0ca41bdef9128528c9be2a0dc9bf79670a01d2e` produced the prior ambiguous and
unresolved owner errors. With this trusted discovery snapshot carried forward
to the candidate, the fixture resolves uniquely to `project-shipwright` and
classifies as `PRODUCT_WITH_VERIFICATION_REGISTRATION` with no errors. This is
not a product `RELEASE_GO` and does not authorize PR #194.

## Authority and integration

The governed path is `SOUNDING_LINE_AUTHORITY_MAINTENANCE`, dispatched only by
the repository owner with the exact protected base and frozen candidate. It
does not issue `RELEASE_GO`. After protected integration, this record must be
updated with the exact integrated main SHA and tree before PR #194 is
reconciled and qualified through the ordinary candidate path.
