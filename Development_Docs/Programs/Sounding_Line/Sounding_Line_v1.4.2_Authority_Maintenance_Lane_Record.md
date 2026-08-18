---
title: Sounding Line v1.4.2 Authority Maintenance Lane Record
audience: engineering
status: current
canonical_for: sounding-line-v1.4.2-authority-maintenance-lane
last_reviewed: 2026-08-18
---

# Sounding Line v1.4.2 authority-maintenance lane

## Prior deadlock

Ordinary candidates reject authority-sensitive files. Verification maintenance also rejects them. A legitimate correction to either authority could therefore not receive governed acceptance without an out-of-band exception.

## Permanent lane

`SOUNDING_LINE_AUTHORITY_MAINTENANCE` is a separate, workflow-dispatch-only lane with disposition `AUTHORITY_MAINTENANCE_GO`, never `RELEASE_GO`. Its trusted protected-main policy has an explicit narrow allowlist for Sounding Line authority code, policy, discovery data, tests, binding code, generated registry output, and Sounding Line records. Product paths are not eligible.

The workflow requires an exact current protected base, frozen candidate SHA and tree, repository-owner dispatch with `owner_authorized=true`, a trusted-base policy and classifier, deterministic test-registry regeneration, focused Sounding Line regression, policy/discovery/ordinary/maintenance/Mainline Train validation, static checks, privacy scan, documentation validation, cleanup, an old-vs-new behavior matrix, and anti-self-authorization evidence. The protected binding selects one matching sealed dispatch artifact and proves candidate/base/merge-parent/tree equality before satisfying the unchanged Mainline Decision context.

## Bootstrap authorization

This v1.4.2 correction is the one-time owner-authorized bootstrap described by the governing task. Before the lane exists on protected main, its trusted-base workflow and policy cannot qualify the first candidate; the old classifier rejection is recorded rather than bypassed silently. A normal protected PR is preferred. Only if that structural deadlock prevents the required check may the repository owner use one protected-branch/admin merge override after the frozen-candidate, focused-test, static/privacy/docs, independent candidate behavior, bounded-diff, and written-receipt conditions are complete. The exception is single-use and must be recorded as consumed after merge.

## Current boundary

The lane cannot authorize product behavior or ordinary `RELEASE_GO`. Verification maintenance remains distinct. The post-merge receipt must record the exact integrated main SHA/tree, protected-branch status, bounded synthetic self-check, and the fact that future authority maintenance no longer needs the bootstrap exception.
