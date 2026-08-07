---
title: Project Homeport Phase 1 Implementation Report
audience: product-engineering
status: current
canonical_for: project-homeport-phase-1-implementation-report
last_reviewed: 2026-08-01
---

# Project Homeport Phase 1 implementation report

## Outcome

Phase 1 implements one ordinary account truth around `AccountSession` and the `wayfarer_account` cookie. It does not start the Phase 2 gateway, global navigation, or account-menu reconstruction. It does not redesign Passport, Community, Tale Session, or invitation presentation.

## Canonical authority and projection

`src/homeport/current-user.server.ts` owns canonical server resolution. It hashes the opaque cookie, loads the bounded session/account/profile/role graph, distinguishes anonymous, expired, revoked, invalid, restricted, and unavailable states, derives exact capabilities, and emits an explicit DTO without email, password material, provider data, token hashes, invitation values, private content, or audit internals.

Player requires an active canonical `PlayerProfile`. Captain, Creator, Moderator, and Administrator derive from active canonical role assignments, with Administrator satisfying staff decisions but never fabricating Player personhood. A deterministic revision digest changes when account, profile, active/revoked role, or session inputs change.

`/api/auth/context` is the primary no-store projection. `/api/shell/context` remains a compatibility envelope derived from that resolver rather than a competing authority. The root `CurrentUserProvider` starts in loading, rejects stale request completions, clears stale private/CSRF projection on failure or ended identity, refreshes after identity mutations, and sends only `{ type: "current-user-invalidated", version: 1 }` across tabs. Focus and visibility are throttled refetch fallbacks.

## Authentication lifecycle

`/sign-in` is the sole ordinary credential product. It exposes Create Account and Forgot Password, complete labels/autocomplete/pending/error semantics, safe return preservation, and the existing Voyagewright auth-ledger visual system across desktop, mobile, and zoom states. Registration, reset, claim, merge, and invitation acceptance establish or rotate the canonical session and refresh current-user context before navigation. Verification refreshes account state without creating a second session.

`/player/sign-in`, `/captain/sign-in`, and `/studio/sign-in` remain stable contextual adapters. They explain intent and lead to canonical account sign-in; they contain no independent password semantics. The Player adapter retains the bounded invitation-code entry. An already authenticated account is capability-checked and never asked for a second ordinary credential.

Safe returns accept only one bounded local path. Absolute, protocol-relative, alternate-scheme, encoded/double-encoded, control-character, backslash, oversized, missing, and unauthorized destinations fall back internally.

## Workspace and explicit-state convergence

Player, Captain, Creator, moderation, Passport, account security, and role surfaces use the canonical resolver. Missing identity, expiry, revocation/invalidity, account restriction, permission denial, and dependency unavailability no longer collapse into one generic sign-in interpretation. Authenticated permission denial retains the profile and gives a safe workspace action. Passport consumes the same client context and clears its private projection when identity changes.

Invitation acceptance now refreshes canonical context before the waiting-room handoff. The loaded waiting-room heading receives focus after its async loading state is replaced, preventing focus from falling back to the document.

## Session mutation and compatibility

Current sign-out revokes the current session; all-session sign-out revokes every active canonical session. The mutations clear `wayfarer_account`, global compatibility identity cookies (`forever_gm` and `chronicle_player`), and tab-scoped `wayfarer-csrf`, then invalidate every tab. They do not mutate Tale Session business state, PlayerAccess campaign scope, pending invitations, or reset/verification tokens.

Ordinary Player and staff writers now issue `AccountSession`; new legacy global-session writes stop. Mapped legacy Player/staff readers rotate into canonical context, delete their legacy cookie, and record `ACCOUNT_COMPATIBILITY_BRIDGED` with only the family name. Unmapped staff identity cannot become ordinary account authority. Contextual Voyage, campaign, invitation, recovery, and presentation hints retain their narrow governed roles.

## Persistence and phase boundary

The existing SQLite/MySQL models represent all mandatory Phase 1 state. No schema, migration, destructive data rewrite, legacy-table deletion, or identity merge was required. Phase 0 evidence remains historical. The compatibility ledger defines the retained observation window; none of the legacy authorities is called retired.

Stable Phase 2 inputs are now one typed current-user projection, one capability decision, a safe return contract, explicit ended/restricted/unavailable states, mutation invalidation, and bounded legacy adapters. Gateway/global navigation and account-menu completeness remain Phase 2 work.
