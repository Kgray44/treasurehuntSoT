---
title: Project Admiralty Phase 3 Integration Manifest
audience: product-owner-engineering-security-quality
status: in-progress
canonical_for: project-admiralty-phase-3-integration-manifest
last_reviewed: 2026-08-13
---

# Project Admiralty Phase 3 integration manifest

## Scope and source

- Working branch: `codex/project-admiralty-phase3-mainline-reconcile`
- Reconciled mainline base: `72075eb551ec39bdb59bd7d78fd900f2eaf73a88`
- Phase 2 baseline: accepted Project Admiralty Phase 2 read-only control plane.
- In scope: owner-backed account/security and Community moderation command
  seams, role partitions, command evidence, and safe operator projections.
- Excluded: Project Admiralty Phase 4, private-content operations, direct
  Prisma business writes from Admiralty, and secret-backed deployment settings.

## Current integration state

The integration is **ready for owner walkthrough but has no protected-main
authority**. Session revocation, active-account suspension, and selected
case-attached Community moderation actions have controlled server routes and
human-facing dossier/listing panels. Their local synthetic browser
qualification includes preview, assurance, confirmation, durable receipts,
CSRF denial, ordinary-user command-center denial, redaction, and accessibility
checks. The full repository build remains blocked by unrelated Bridgewatch
dependencies, so this is not a production-build qualification.

| Family               | Owner               | State                               | Integration boundary                                                                                                    |
| -------------------- | ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Session revocation   | Wayfarer            | `PARTIALLY_IMPLEMENTED`             | Owner transaction invalidates session/assurance, writes security/audit evidence, and persists a durable receipt.        |
| Account suspension   | Wayfarer            | `PARTIALLY_IMPLEMENTED`             | Active-account, revision-checked owner transition with immediate session invalidation and durable receipt.              |
| Community moderation | Harborlight         | `PARTIALLY_IMPLEMENTED`             | Case-attached, revision-checked owner action with a required independent eligible reviewer and transaction-bound audit. |
| Role assignment      | Wayfarer            | `OWNER_EXTENSION_REQUIRED`          | Bootstrap reconciliation is not an operational role-management contract.                                                |
| Job control          | Job owner           | `BLOCKED_BY_MISSING_OWNER_CONTRACT` | Existing workers expose no safe administrator retry, requeue, or cancellation contract.                                 |
| Typed configuration  | Configuration owner | `BLOCKED_BY_MISSING_OWNER_CONTRACT` | Current settings are deployment- or secret-managed; no typed runtime setting owner exists.                              |

## Owner walkthrough boundary

The walkthrough must use the disposable synthetic fixture only and must not
exercise blocked command families. A future owner command contract may unblock
only its named family; it must not be inferred from a table, worker, seed
script, or bootstrap reconciler.

No Sounding Line authority or protected-main binding has been requested or run.
