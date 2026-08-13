---
title: Project Admiralty Phase 3 Integration Manifest
audience: product-owner-engineering-security-quality
status: in-progress
canonical_for: project-admiralty-phase-3-integration-manifest
last_reviewed: 2026-08-13
---

# Project Admiralty Phase 3 integration manifest

## Scope and source

- Working branch: `codex/project-admiralty-phase3-take-the-watch`
- Starting accepted mainline: `60b89841986e66fbc2c0828489d38002a1617506`
- Phase 2 baseline: accepted Project Admiralty Phase 2 read-only control plane.
- In scope: owner-backed account/security and Community moderation command
  seams, role partitions, command evidence, and safe operator projections.
- Excluded: Project Admiralty Phase 4, private-content operations, direct
  Prisma business writes from Admiralty, and secret-backed deployment settings.

## Current integration state

The integration is **not ready for owner walkthrough or protected-main
authority**. Session revocation, active-account suspension, and selected
case-attached Community moderation actions have controlled server routes and
human-facing dossier/listing panels, but each remains
`PARTIALLY_IMPLEMENTED` until its full qualification evidence is complete.

| Family               | Owner               | State                               | Integration boundary                                                                                               |
| -------------------- | ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Session revocation   | Wayfarer            | `PARTIALLY_IMPLEMENTED`             | Owner transaction invalidates session/assurance and writes security/audit evidence.                                |
| Account suspension   | Wayfarer            | `PARTIALLY_IMPLEMENTED`             | Active-account, revision-checked owner transition with immediate session invalidation.                             |
| Community moderation | Harborlight         | `PARTIALLY_IMPLEMENTED`             | Case-attached, revision-checked owner action with a required distinct second reviewer and transaction-bound audit. |
| Role assignment      | Wayfarer            | `OWNER_EXTENSION_REQUIRED`          | Bootstrap reconciliation is not an operational role-management contract.                                           |
| Job control          | Job owner           | `BLOCKED_BY_MISSING_OWNER_CONTRACT` | Existing workers expose no safe administrator retry, requeue, or cancellation contract.                            |
| Typed configuration  | Configuration owner | `BLOCKED_BY_MISSING_OWNER_CONTRACT` | Current settings are deployment- or secret-managed; no typed runtime setting owner exists.                         |

## Required downstream work

Before any owner walkthrough, satisfy the Phase 3 test plan’s remaining
negative-path, durable idempotency, authorization, privacy, accessibility, and
browser-journey evidence. A future owner command contract may unblock only its
named family; it must not be inferred from a table, worker, seed script, or
bootstrap reconciler.

No Sounding Line authority or protected-main binding has been requested or run.
