---
title: Project Homeport Phase 1 Identity and Session Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-1-identity-session-architecture
last_reviewed: 2026-08-01
---

# Project Homeport Phase 1 identity and session architecture

## Scope and authority

This contract freezes Phase 1, **Unite Identity and Session Authority**, before implementation. It is subordinate to the Voyagewright Global Product Governance Standard and the Project Homeport governing document. It owns convergence across Wayfarer, True North, One Voyage, Harborlight, Sealed Hold, Lanternwake, Universal Language, and Sounding Line boundaries without absorbing those specialist domains or starting Phase 2.

## Canonical server authority

`AccountSession` is the canonical session record and `wayfarer_account` is its only ordinary product-account cookie. Raw tokens are generated at authentication boundaries, stored only as SHA-256 hashes, and never returned by current-user or audit projections. `UserAccount` owns account status, `PlayerProfile` owns Player personhood, and active global `AccountRoleAssignment` rows own staff capability.

The current-user resolver returns one of these safe states:

| State           | Meaning                                                                                  | Required client behavior                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `anonymous`     | No canonical cookie exists.                                                              | Show anonymous controls without implying expiry or denial.                                             |
| `authenticated` | Session is unrevoked, unexpired, account is usable, and safe identity data is available. | Use only returned capabilities, workspaces, session metadata, and CSRF value.                          |
| `expired`       | A matching session exists but its expiry is past.                                        | Explain expiry, retain a safe intended return, and offer canonical sign-in.                            |
| `revoked`       | A matching session was revoked.                                                          | Explain that the session ended, clear client hints, and offer canonical sign-in.                       |
| `invalid`       | A cookie exists but matches no canonical session/account.                                | Treat as ended, never as authenticated, and offer canonical sign-in.                                   |
| `restricted`    | Account is locked, suspended, merged, or otherwise outside allowed statuses.             | Preserve identity privacy, explain restriction generically, and do not offer a capability bypass.      |
| `unavailable`   | The authoritative dependency could not be read.                                          | Remove stale identity, show correlation/retry information, and never fall back to anonymous authority. |

The client-only `loading` state reserves shell geometry and exposes no authenticated controls.

## Safe authenticated DTO

The authenticated projection may contain only bounded display name, initials, optional public handle, account/profile opaque IDs required by first-party consumers, booleans for Player/Captain/Creator/Moderator/Administrator, permitted workspace identifiers, current session ID/expiry, CSRF token, a deterministic authority `revision`, and a protocol `contextVersion`. It must not contain email, password or credential metadata, provider subject or tokens, raw session tokens, role grant metadata, IP data, private content identifiers, invitation credentials, Tale Session access tokens, or raw error details.

## Capability decisions

Every protected entry resolves to exactly one `CapabilityDecision`:

- `allowed` with the authenticated context;
- `auth-required` for a genuinely anonymous browser;
- `expired` or `revoked`/`invalid` for ended identity;
- `permission-denied` for an authenticated account without the capability;
- `account-restricted` for a locked, suspended, merged, or disabled account;
- `unavailable` with a correlation ID and retry instruction when authority cannot be read.

Player capability requires an active `PlayerProfile`; a `PLAYER` role row alone is insufficient. Captain requires `CAPTAIN`, Creator accepts `CREATOR` or `PUBLISHER`, Moderator accepts `MODERATOR`, and Administrator requires `ADMINISTRATOR`. Administrator may satisfy Captain, Creator, or Moderator decisions, but it does not create a Player profile.

## Sign-in and return contract

`/sign-in` is the only ordinary password surface. It visibly links Create Account and Forgot Password. `/player/sign-in`, `/captain/sign-in`, and `/studio/sign-in` retain stable URLs as adapters that explain the requested workspace and forward to canonical sign-in. The Player adapter also retains the bounded invitation-code ceremony. An authenticated account is capability-checked and either continues, receives an explicit permission state, or receives a restriction/unavailable state; it is never asked to enter a second password.

Only a local path beginning with one `/` is a valid return. Absolute URLs, protocol-relative paths, schemes, backslashes, control characters, encoded or double-encoded separators/schemes, and values over 2,048 characters are rejected. The authenticated context is freshly resolved after sign-in or registration. The requested destination is used only after its capability requirement is satisfied; otherwise the workspace fallback or `/` is used.

## Invalidation and multi-tab contract

Every authentication mutation directly invalidates and refetches the current tab's current-user context. Other same-origin tabs receive a `BroadcastChannel` payload exactly shaped as `{ type: "current-user-invalidated", version: 1 }`. No account, role, session, CSRF, or credential value is broadcast. Focus and visibility changes trigger a throttled no-store refetch for browsers without a working channel and for server-side revocations. A monotonic request generation prevents an older request from overwriting newer state. A failed current refetch replaces the prior value with `unavailable`; stale authenticated UI is forbidden.

## Sign-out and compatibility contract

Current-session sign-out revokes the matching `AccountSession`. All-session sign-out revokes all active `AccountSession` rows for the account. Both delete `wayfarer_account`, `forever_gm`, and `chronicle_player`, clear the client `wayfarer-csrf` hint, and invalidate/refetch every open tab. They do not delete `chronicle_pending_invitation`, `chronicle_session`, `forever_player`, reset/verification tokens, invitations, playthrough membership, progress, or Tale Session records.

`forever_gm` and `chronicle_player` are observe-and-rotate readers only. A valid legacy reader must resolve its canonical account, issue a fresh `AccountSession`, set `wayfarer_account`, and delete the legacy cookie. Failure to resolve cannot grant authority. The staff compatibility endpoint remains available for bounded legacy entry but ordinary Captain/Creator entry uses canonical sign-in. Compatibility retirement requires measured zero reachability and a later governed decision; Phase 1 does not delete tables.

## Privacy, error, and audit contract

Security failures expose bounded copy and, for dependency failure, an opaque correlation ID. Server logs and `SecurityEvent` metadata contain event kind and bounded opaque identifiers only. Raw tokens, credentials, CSRF values, provider material, database paths, private story data, and invitation credentials are prohibited from UI, logs, receipts, broadcasts, and tracked fixtures.

## Verification contract

Required Phase 1 test contracts are `homeport.auth.single-product`, `homeport.registration.reachable`, `homeport.registration.success-destination`, `homeport.signin.lifecycle-links`, `homeport.session.convergence`, `homeport.context.failure-state`, `homeport.shell.auth-refresh`, `homeport.capability.player-agreement`, `homeport.capability.staff-agreement`, `homeport.permission.explicit`, `homeport.signout.visible`, `homeport.signout.multi-tab`, `homeport.signout.compatibility`, `homeport.session.expiry`, `homeport.session.revocation`, `homeport.session.restricted-account`, `homeport.current-user.no-stale-overwrite`, `homeport.current-user.no-client-authority`, `homeport.return-to.safe`, `homeport.passport.session`, `homeport.invitation.account-handoff`, `homeport.legacy-player.rotation`, `homeport.legacy-staff.bridge`, and `homeport.compatibility.observation`. Sounding Line owns selection, isolation, evidence freshness, and release-decision semantics.

## Migration decision and rollback

No schema change is authorized. Existing SQLite and MySQL Prisma models already satisfy the frozen contract. Rollback is a code-and-document commit revert while retaining all account, session, invitation, and Tale Session data. Compatibility readers remain available, so rollback does not require destructive database action.
