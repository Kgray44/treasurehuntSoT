---
title: Project Admiralty Phase 1 Design Record
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-1-design
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 Design Record

## Decision

Phase 1 is an independently mainline-safe Class A/B increment. It extends the
canonical `UserAccount`, `AccountSession`, `AccountRoleAssignment`, and
`PlatformAuditEvent` authorities. It does not introduce a second administrator
identity, login, password, session cookie, person table, or audit truth.

The exact starting mainline is `f1c2f22dd935322c1a71eb80c51592f243dc196d`.
Reconciliation must repeat before any integration decision.

## Frozen contracts

| Contract       | Decision                                                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability     | Stable `AdmiraltyCapabilityId`; one server resolver expands active canonical role assignments and returns explicit allow/deny reasons.                                                                                                                               |
| Role           | `ADMINISTRATOR`, `SUPPORT_OPERATOR`, `SECURITY_OPERATOR`, `MODERATION_OPERATOR`, `OPERATIONS_OPERATOR`, `RELEASE_OPERATOR`, `AUDIT_OPERATOR`, and `EMERGENCY_OPERATOR` are registry definitions, not identities.                                                     |
| Bootstrap      | An explicit reconciliation command resolves existing canonical account IDs or exact normalized primary emails, writes canonical role assignments, audits in the same transaction, and otherwise fails closed. Environment membership is never runtime authorization. |
| Assurance      | Base access derives from the canonical session and current role. Recent reauthentication is a short-lived database record bound to the same account and session. No bearer elevation token is issued.                                                                |
| Support Access | An operator requests exact safe scopes for one target; the target approves or denies; an expiring grant authorizes only the requesting operator, target, and scopes; either target or security authority can revoke.                                                 |
| Audit          | `PlatformAuditEvent` remains canonical. Administrative events use bounded, recursively sanitized summaries and stable correlation IDs. Critical mutations place the state change and audit event in one transaction.                                                 |
| Registry       | The versioned JSON registry is the living floor, not a maximum. Registered-only items remain truthful and non-clickable.                                                                                                                                             |
| Route          | `/admin` returns deliberate not-found behavior before projection for unauthorized sessions. This reduces route disclosure but never substitutes for server authorization.                                                                                            |
| Consent        | `/account/support-access` is an ordinary Personal Harbor destination because affected users must be able to review and revoke access. It exposes no administrator surface.                                                                                           |

## Ownership boundaries

- Wayfarer and Homeport retain account, session, credential, role, Profile,
  privacy, CSRF, and ordinary shell authority.
- One Voyage retains Chronicle, edition, Voyage, and canonical audit ownership.
- Harborlight retains Community and moderation state.
- Sealed Hold retains protected content, keys, provider credentials, and private
  media. Ordinary Support Access never projects private Chronicle prose/media.
- Admiralty owns policy resolution, privileged assurance, Support Access grants,
  administrative projection, and administrative audit composition only.

## Data design

`PrivilegedAssurance` is account/session bound and short lived.
`SupportAccessRequest` retains the purpose, exact requested scopes, decision,
expiry, and correlation. `SupportAccessGrant` retains the exact operator,
target, granted scopes, expiry, and revocation state. Sensitive reads are not a
new table: each use is canonical `PlatformAuditEvent` evidence.

SQLite migration `20260809120000_admiralty_phase1_foundation` and MySQL
migration `0052_admiralty_phase1_foundation` are reserved together. Both are
additive. No existing row is rewritten or deleted.

## Assurance policy

Authorized operators enter the limited shell at `ADMIN_BASE`. Password-backed
accounts may obtain `ADMIN_REAUTHENTICATED` assurance for ten minutes. The
method type leaves an explicit seam for later governed OAuth reauthentication
or stronger methods. An OAuth-only account receives a safe unavailable result
until that method is implemented; it is never silently elevated.

Validity always rechecks the parent account session and current active role.
Therefore session revocation, expiry, account restriction, or role revocation
invalidates assurance immediately even if the historical record remains.

## Support policy

The grant lifetime is at most thirty minutes. Supported scopes are
`ACCOUNT_STATE`, `AUTH_EVENTS`, `CHRONICLE_HISTORY_METADATA`,
`COMMUNITY_ACTIVITY`, `SESSION_DIAGNOSTICS`, and `PROFILE_DIAGNOSTICS`.
Credential material, raw tokens, provider secrets, encryption keys, private
Chronicle prose, and private media are not representable scopes.

## Route and UI design

The admin route uses a dedicated administration shell classification and has no
ordinary navigation item. The Phase 1 view contains current operator identity,
capabilities, assurance, safe environment/application identity, Support Access
controls, recent administrative audit summaries, and registry coverage. It has
no fake People, Chronicle, release, backup, worker, repair, or emergency
controls.

## Acceptance boundary

The new administrator and user-consent surfaces are human-facing. The global
governance standard therefore requires an owner walkthrough after technical
gates. Automated readiness cannot self-accept that walkthrough, and Phase 2 may
not begin under this record.
