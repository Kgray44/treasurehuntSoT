---
title: Project Admiralty Phase 3 Integration Manifest
audience: product-owner-engineering-security-quality
status: in-progress
canonical_for: project-admiralty-phase-3-integration-manifest
last_reviewed: 2026-08-18
---

# Project Admiralty Phase 3 integration manifest

## Scope and source

- Working branch: `codex/project-admiralty-phase3-mainline-reconcile`
- Paused checkpoint: `56caa166a5ab6171f4d9d7e4b0ed544a92f541d5`
- Reconciled mainline base: `fc39942a1d8fe57fc13f35cae01445e704b94c45`
- Latest reconciliation merge: `ef204d2bb0a2da7bc1c87a360fc3b9a2c8441205`
- Phase 2 baseline: accepted Project Admiralty Phase 2 read-only control plane.
- In scope: owner-backed account/security and Community moderation command
  seams, role partitions, command evidence, and safe operator projections.
- Excluded: Project Admiralty Phase 4, private-content operations, direct
  Prisma business writes from Admiralty, and secret-backed deployment settings.

## Current integration state

The integration is **in current v1.4 candidate qualification and has no
protected-main authority**. Session revocation, active-account suspension, and selected
case-attached Community moderation actions have controlled server routes and
human-facing dossier/listing panels. Their local synthetic browser
qualification includes preview, assurance, confirmation, durable receipts,
CSRF denial, ordinary-user command-center denial, redaction, and accessibility
checks. Reconciliation adopted the current Sounding Line v1.4 authority and
Bridgewatch contracts without source conflict. The current owner/command suite,
Phase 2 validator, and Phase 3 migration rehearsal pass. With recovered host
capacity, the relocated Phase 3 production runner completed both Chromium
journeys (2/2) against a disposable synthetic fixture. The earlier `ENOSPC`
interruption remains historical only and is not the current browser result.

The paused v1.3-era focused evidence is preserved as
`PRESERVED_NONAUTHORITATIVE_PENDING_V14_SEMANTIC_ADOPTION`. It is not a v1.4
authority receipt and must be evaluated under the v1.4 legacy-evidence policy
by a future authorized Mainline Decision.

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

One trusted-main candidate dispatch (run `32139698315`) rejected before product
tests because the prior candidate placed new test helpers outside the
ordinary-candidate path surface. No Mainline Decision, protected-main binding,
`RELEASE_GO`, or merge exists. The repaired candidate may be dispatched only
after it is frozen and requalified at its exact SHA.
