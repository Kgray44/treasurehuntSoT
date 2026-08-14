---
title: Project Admiralty Phase 3 Integration Manifest
audience: product-owner-engineering-security-quality
status: in-progress
canonical_for: project-admiralty-phase-3-integration-manifest
last_reviewed: 2026-08-14
---

# Project Admiralty Phase 3 integration manifest

## Scope and source

- Working branch: `codex/project-admiralty-phase3-mainline-reconcile`
- Paused checkpoint: `56caa166a5ab6171f4d9d7e4b0ed544a92f541d5`
- Reconciled mainline base: `268932d630ee0ea1721d0072da4041f7209b7464`
- Reconciliation merge: `32f45c88665f8597bc642917ca523ca87d650566`
- Phase 2 baseline: accepted Project Admiralty Phase 2 read-only control plane.
- In scope: owner-backed account/security and Community moderation command
  seams, role partitions, command evidence, and safe operator projections.
- Excluded: Project Admiralty Phase 4, private-content operations, direct
  Prisma business writes from Admiralty, and secret-backed deployment settings.

## Current integration state

The integration is **ready for Sounding Line v1.4 Mainline acceptance but has
no protected-main authority**. Session revocation, active-account suspension, and selected
case-attached Community moderation actions have controlled server routes and
human-facing dossier/listing panels. Their local synthetic browser
qualification includes preview, assurance, confirmation, durable receipts,
CSRF denial, ordinary-user command-center denial, redaction, and accessibility
checks. Reconciliation adopted the current Sounding Line v1.4 authority and
Bridgewatch contracts without source conflict; current-source local production
build and the Phase 2 and Phase 3 browser journeys pass on the disposable
synthetic fixtures.

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

No Sounding Line v1.4 Mainline Decision or protected-main binding has been
requested or run. Both remain held until the independent v1.4 post-cutover
hosted browser-fixture closure is green.
