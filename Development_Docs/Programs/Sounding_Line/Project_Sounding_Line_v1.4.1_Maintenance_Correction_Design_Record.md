---
title: Sounding Line v1.4.1 Maintenance Correction Design Record
status: implementation
audience: engineering
---

# Sounding Line v1.4.1 Maintenance Correction

## Purpose

v1.4.1 retires the routine administrator-bootstrap repair loop exposed during
the v1.4 protected-main self-verification. It preserves v1.4's semantic-impact,
prepared-runtime, tree-binding, and Mainline Train architecture.

## Stable governed test identity

Every active generated registry entry has two identities:

- `semanticId` is the durable identity for the governed behavior and contract.
- `id` is the generated runtime representation used to select execution.

Historical aliases may resolve a former generated ID only when they resolve to
exactly one active semantic identity. Duplicate semantic IDs, ambiguous aliases,
or aliases that collide with active generated IDs fail closed. P34 replacement
records retain generated IDs for receipt compatibility and add corresponding
semantic IDs for durable historical resolution. Replacement cycles and unresolved
historical mappings are rejected by the retirement validator.

## Qualification separation

`RELEASE_GO` remains the only ordinary product and project release disposition.
`MAINTENANCE_GO` is a separate, exact-candidate disposition for a bounded
`VERIFICATION_MAINTENANCE` candidate. The eligible path set is machine-readable
in `testing/verification-maintenance-policy.json`.

The maintenance classifier and policy are loaded from the exact current protected
base, not from the candidate. Changes to the policy, classifier, authority index,
planner, finalizer, protected-binding semantics, or authority workflows are
classified as authority changes and cannot self-authorize. Product, mixed,
unknown, and empty scope reject fail closed.

## Protected integration

The dedicated `Sounding Line verification maintenance` workflow seals the exact
candidate SHA, candidate tree, trusted-main SHA, qualified base, scope result,
and required evidence. The existing protected context, `Sounding Line / Mainline
Decision`, accepts a `MAINTENANCE_GO` only through a separate trusted binding that
requires the exact synthetic merge parents and landed tree. The ordinary binding
continues to require a sealed `RELEASE_GO`.

## v1.4.1 authority-bootstrap boundary

This initial correction changes the maintenance definition and protected binding
itself. It is consequently an authority-change candidate and is intentionally
rejected by the maintenance classifier. Its integration must use the separately
owner-authorized authority-change procedure; once protected main contains this
record and implementation, routine eligible maintenance no longer needs an
administrator exception.

## Historical disposition

The historical v1.4 atomic-one-merge cutover deviation remains preserved and is
not rewritten or concealed. This correction does not modify product behavior or
weaken branch protection.
