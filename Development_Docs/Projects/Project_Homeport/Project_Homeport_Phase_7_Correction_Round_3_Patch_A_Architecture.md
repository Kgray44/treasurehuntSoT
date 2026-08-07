---
title: Project Homeport Phase 7 Correction Round 3 Patch A Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-patch-a-architecture
last_reviewed: 2026-08-06
---

# Project Homeport Phase 7 Correction Round 3 Patch A architecture

## Scope and status boundary

Patch A is a short blocking stabilization patch inside Correction Round 3. It
owns only canonical account registration, email verification, ordinary sign-in,
password guidance, partial-account reconciliation, and the ProductShell route
transition lifecycle. It is not Correction Round 4, Phase 8, a Personal Harbor
or Community redesign, workspace expansion, deployment, merge, or pull request.

Earlier owner records remain unchanged. Round 3 remains
`PENDING_OWNER_DECISION`. The highest Patch A result is ready for focused owner
review; automation cannot establish broader owner acceptance.

## Frozen source and isolation

| Field                           | Frozen value                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Published Patch A baseline      | `58f88e6ec1447d19b07213003c3499c4b4c0c884`                                                                                 |
| Branch                          | `codex/project-homeport-product-reality-recovery`                                                                          |
| Worktree                        | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                                                                     |
| Start parity                    | local, tracking, and advertised remote equal; `0/0` divergence                                                             |
| Canonical database before-state | `df33983556cf2c6ff01df6084ae6619ec5df5c99b11241fa88b4a88f8e144eeb`                                                         |
| Task root                       | `C:\Users\kkids\AppData\Local\ProjectHomeport\phase7-owner-correction-round3-patch-a-019fd7fa-ac8d-7960-9bc9-81eb6f625e9d` |
| Fixture family                  | `homeport-phase7-owner-correction-round3-patch-a-v1`                                                                       |
| Task-owned port family          | `3781`-`3792`                                                                                                              |
| Email provider selected state   | Resend selected; synthetic test adapter retained; Postmark compatibility dormant                                           |

All mutation-bearing tests use purpose-specific databases under the task root.
The canonical database and prior-round owner databases are forbidden mutation
targets. No credential, password, verification code, provider secret, raw trace,
or task database may be committed.

## Findings authority

The 22 exact owner observations are assigned additive IDs
`HP-OWCR3-PATCH-A-001` through `HP-OWCR3-PATCH-A-022` in the dedicated findings
ledger. They do not renumber or rewrite `HP-OWCR3-001` through `HP-OWCR3-054` or
the earlier owner history.

## Diagnosed baseline failures

Registration currently commits `UserAccount`, `PlayerProfile`, `AccountEmail`,
credential, role, and audit state before `issueToken` creates the verification
challenge and dispatches email. A provider or synthetic-outbox failure after the
first transaction therefore throws a generic unavailable result while leaving a
durable pending account and reserved email.

Route readiness currently uses React `children` identity as a preparation
signal. App Router may retain that identity while the incoming DOM is already
ready. The boundary then retains the outgoing snapshot at full animated opacity,
arms a 500 ms fallback, replaces the ready incoming page with loading, and uses a
700 ms forced settlement. This creates both the delayed spinner and the
destination-to-old-page-to-destination flash.

Implementation tracing also exposed one second route defect through the
retained Round 3 slow-transition journey. When an initially settled page still
contained a Next.js pending marker, snapshot capture returned before installing
its readiness observer. A later DOM-only readiness change therefore left no
settled outgoing snapshot and allowed a background-only frame. The corrected
boundary always installs generation-owned readiness observation, even when the
first capture is pending.

## Frozen account decisions

1. Input normalization and password/display-name/email validation occur before
   persistence.
2. Display-name and email uniqueness are checked before creation and enforced by
   provider-equivalent durable uniqueness where needed for concurrency.
3. The pending account, Profile, primary email, credential, baseline Player role,
   verification challenge, verification session, and audit event are created in
   one database transaction.
4. Display-name conflict creates zero account/email rows, stays on Sign Up, and
   returns `That display name is already in use.` as an inline Display Name
   error.
5. Existing email creates zero rows and hands off to Sign In with a safe prefill,
   Forgot Password, and `An account already uses this email address. Sign in
instead.`
6. Delivery occurs after commit. A delivery failure leaves exactly one truthful,
   retryable pending account and returns `Your account was created, but we could
not send the verification email.` with Retry, Change email, Sign in, and
   recovery guidance.
7. Repeated submission cannot create a second account or second email
   reservation. Delivery retry rotates the challenge and never creates an
   account.
8. Registration verification still uses the hashed, expiring, single-use,
   attempt-limited, resend-limited six-digit challenge.
9. Valid returning credentials always create an ordinary `AccountSession`.
   Primary-email verification is not an ordinary sign-in factor.
10. An unverified signed-in account receives a typed non-blocking verification
    notice, Resend, governed Change email, and Personal Information status.
    Only operations with a real verified-email policy remain restricted.
11. Password strength uses understandable text and an accessible meter. The
    server enforces minimum length, common-password rejection, and safe
    similarity checks without decorative arbitrary complexity.
12. Confirmation reports match/mismatch only after entry begins; client and
    server reject mismatch and never log values.
13. A task-owned DRY_RUN/COMMIT/VERIFY reconciliation command classifies pending
    structural inconsistencies, repairs only sufficient and governed cases,
    preserves valid pending accounts, is idempotent, and writes secret-safe exact
    counts under the task root.

## Frozen route-transition decisions

1. One monotonically increasing navigation generation owns route identity,
   readiness, loading threshold, snapshot, focus, and cleanup.
2. Beginning a navigation invalidates all prior timers, frames, async callbacks,
   and snapshots. A stale generation cannot write state.
3. The outgoing page is an inert visual layer only during the intentional
   overlap. It starts fading immediately and can never return after settlement.
4. Destination readiness is explicit DOM lifecycle state, never React-node
   identity or text equality.
5. Readiness before 500 ms cancels loading permanently for that generation.
   Readiness at 499 ms also suppresses it. Readiness after 500 ms may dismiss one
   loading state exactly once.
6. The ordinary route token is 280 ms with overlapping opacity and a restrained
   4 px incoming settle. The ProductShell remains stable and interaction is not
   delayed after destination settlement.
7. Sign-in, registration, verification, recovery, Home, push, replace, Back, and
   Forward all consume this same transition authority.
8. Reduced motion removes spatial motion and uses immediate or very short
   opacity without spinner or stale-layer flashes.

## Verification and closure

Focused service, API, component, route-transition, accessibility, mobile,
privacy, rate-limit, CSRF, enumeration-policy, migration, and reconciliation
tests precede production-shaped journeys A-N. Temporal evidence records route
generation, layer visibility/opacity, loading visibility, focus, duration, and
source identity; a static screenshot alone cannot prove absence of a flash.

Closure additionally requires prior Round 3 critical journeys, original Phase 7
authentication/account journeys, Phase 5 route gate, Phase 6 surface/state gate,
Sounding Line subsystem and mainline `RELEASE_GO`, canonical-database invariance,
exact branch parity, and one fresh healthy owner-review runtime. Live Resend
email may be claimed only after provider submission, approved inbox receipt, and
successful application consumption of the received code are all proven.

## Critical Captain and Creator authentication addendum

1. `AccountSession` is the only ordinary authentication lifecycle for Player,
   Captain, and Creator workspaces.
2. Workspace availability and resource authorization are separate. Any active,
   verified ordinary account may enter Captain and Creator; access to a specific
   Voyage, session, invitation, helper pairing, Chronicle, asset, import, or
   export remains owner/scoped-collaborator/admin controlled.
3. New resources record canonical account ownership. Existing canonical and
   migrated legacy owner fields remain compatible during convergence.
4. Ordinary routes never prompt for GameMaster, Captain, or Creator credentials.
   `/api/gm/**` remains a compatibility surface only, and the private operations
   console remains explicitly privileged admin-only.
5. Cross-workspace navigation preserves one account ID, one canonical session,
   and one CSRF lifecycle; it does not mint legacy role cookies.

## Implemented Patch A disposition

Exact product source `0edae8a4509656f98d68aa248f6ee7fb087436eb` implements
the frozen decisions. Registration now commits the pending account, Profile,
primary email, credential, baseline Player capability, verification challenge,
verification session, and audit event atomically. Delivery occurs after commit
and has a truthful retryable failure state. Returning credentials establish the
ordinary account session regardless of primary-email verification; verification
remains a non-blocking follow-up for ordinary navigation.

The route boundary now uses one monotonically increasing generation for timers,
snapshots, readiness, loading, settlement, focus, and cleanup. The ordinary
crossfade is 280 ms with a 4 px incoming settle; the loading threshold remains
500 ms. Readiness cancels loading permanently for its generation, stale
generations cannot write state, and initially pending settled pages retain
readiness observation so there is no background-only gap.
