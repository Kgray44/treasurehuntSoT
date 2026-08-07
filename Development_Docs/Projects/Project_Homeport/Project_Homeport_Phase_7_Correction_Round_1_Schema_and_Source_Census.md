---
title: Project Homeport Phase 7 Correction Round 1 Schema and Source Census
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-1-schema-source-census
last_reviewed: 2026-08-04
---

# Phase 7 correction Round 1 schema and source census

This census was recorded after architecture commit `ed8f1ef5316f11340276bebe6c70715159321ef6` and before any schema edit.
It authorizes only the additive gaps below.

## Accepted authority retained

| Concern                                   | Accepted representation                    | Decision                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Account, claim state, status, and profile | `UserAccount`, `PlayerProfile`             | Reuse. Human-state projection must hide raw internal values.                                                                              |
| Primary and verified email                | `AccountEmail`                             | Reuse its case-insensitive normalized unique address and verification state.                                                              |
| Password and one-time challenges          | `AccountCredential`, `AccountToken`        | Reuse hashed tokens, expiry, one-time consumption, and credential hashing.                                                                |
| Sessions and security audit               | `AccountSession`, `SecurityEvent`          | Reuse for reauthentication consequences, revocation, and audit.                                                                           |
| Workspace capabilities                    | `AccountRoleAssignment`                    | Reuse global `PLAYER`, `CAPTAIN`, and `CREATOR` capability rows. No parallel role account is permitted.                                   |
| Active Player participation               | `PlaythroughMembership` plus `TaleSession` | Reuse for the server-owned workspace lock and safe-leave transition.                                                                      |
| Linked identities                         | `ExternalIdentity`, `ProviderLinkAttempt`  | Reuse collision protection, bounded state/PKCE/nonce attempt, encrypted-token field, safe summary, revocation, and last-login protection. |
| Community reviews and search              | Existing Harborlight models and services   | Reuse. Presentation and placement need no schema change.                                                                                  |
| Preferences                               | `ProfilePreferenceSet.payload`             | Reuse. Inert visible controls are removed while retained payload keys remain forward-compatible.                                          |
| Profile identity                          | `PlayerProfile.displayName`                | Reuse; only Personal Information may mutate it.                                                                                           |

## Confirmed additive gaps

| Gap                             | Missing invariant                                                                                                                                                                 | Why an adapter is insufficient                                                                                                                | Authorized additive representation                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chronicle-specific alias        | `PlaythroughMembership` cannot retain the name used by one canonical participant in one Chronicle. `TaleSession.ownerLabel` is session-wide and cannot represent multiple people. | Encoding the alias into preferences or session configuration would detach it from participant authority and weaken uniqueness/audit behavior. | Nullable bounded `participationAlias` and `participationAliasEditedAt` on `PlaythroughMembership`. Existing rows remain null and continue to project their historical snapshot/fallback. |
| Pending email-change target     | `AccountToken` proves a challenge purpose but cannot bind an email-change token to the requested normalized/display address.                                                      | Putting an address into `purpose` or an unhashed client cookie would be ambiguous and unsafe.                                                 | Nullable `pendingNormalizedEmail` and `pendingDisplayEmail` on `AccountToken`, used only for `EMAIL_CHANGE`.                                                                             |
| Export lifecycle                | No accepted record can represent requested/building/ready/failed/expired export state, checksum, versioned manifest, authorized payload, or expiry.                               | A `SecurityEvent` is append-only audit, not an owner-readable job or download authority.                                                      | `AccountDataExport` owned by `UserAccount`, with state, version, manifest, payload, checksum, timestamps, expiry, and failure summary.                                                   |
| Deactivation/deletion lifecycle | `UserAccount.status` can gate access but cannot retain request kind, scheduled date, cancellation/reactivation boundary, completion, or reason.                                   | Reconstructing lifecycle from status and security events would be lossy and non-idempotent.                                                   | `AccountLifecycleRequest` owned by `UserAccount`, with kind, state, request/schedule/cancel/complete timestamps, cancellation boundary, reason, and version.                             |

## Explicit non-gaps

No new account root, email table, credential table, session table, role/capability table, provider identity table, provider
attempt table, preference table, review table, search table, or separate public display-name field is authorized. Account
deletion remains an anonymizing/tombstoning lifecycle; it does not cascade-delete authoritative Chronicle, Community,
consent, audit, or provenance history.

## Migration boundary

The migration must be additive for SQLite and MySQL, preserve every existing row, support a fresh database and an
upgrade from the Phase 7 baseline, and admit forward-fix. Rollback rehearsal may remove only an empty new table or
new nullable column on a disposable clone; it must not rewrite retained owner or canonical data.
