---
title: Project Homeport Phase 7 Correction Round 3 Patch A Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-patch-a-test-plan
last_reviewed: 2026-08-06
---

# Project Homeport Phase 7 Correction Round 3 Patch A test plan

## Isolation

Use fixture `homeport-phase7-owner-correction-round3-patch-a-v1`, task-owned
database clones, media/outbox/browser roots, and ports 3781-3792. Never migrate
or mutate canonical `prisma/dev.db`. Passwords and verification codes are
runtime-only secrets and must not enter evidence.

## Focused contracts

Sounding Line registers the exact Patch A contract IDs:

- `homeport.auth.identifier.username`
- `homeport.auth.identifier.email`
- `homeport.auth.unverified-signin`
- `homeport.auth.registration.atomic`
- `homeport.auth.registration.username-conflict`
- `homeport.auth.registration.email-handoff`
- `homeport.auth.password-strength`
- `homeport.auth.password-confirmation`
- `homeport.auth.registration-verification`
- `homeport.auth.postmark-delivery`
- `homeport.auth.partial-account-repair`
- `homeport.transition.navigation-generation`
- `homeport.transition.delayed-loading-cancel`
- `homeport.transition.no-late-spinner`
- `homeport.transition.no-route-resurrection`
- `homeport.transition.direct-crossfade`
- `homeport.transition.auth-routes`
- `homeport.transition.interruption`
- `homeport.transition.back-forward`
- `homeport.transition.reduced-motion`

- Registration: new account; display-name, email, and combined conflicts;
  invalid/common/similar/mismatched passwords; provider failure; retry;
  repeated submission; transaction rollback; zero orphan email; exact row-count
  invariants.
- Sign-in: verified, unverified, wrong password, restricted, pending lifecycle,
  safe return, no ordinary code challenge, non-blocking verification notice.
- Password UI: all four strength levels, common password, match/mismatch, paste,
  mobile, accessibility, and no logging.
- Reconciliation: DRY_RUN, COMMIT, VERIFY, exact counts, sufficient repair,
  protected valid pending accounts, idempotence, and canonical-path rejection.
- Route unit: timer cancellation, generation invalidation, stale-result
  rejection, 200/499/501 ms readiness, second navigation, real failure, unmount,
  Back/Forward, reduced motion, and no outgoing-layer resurrection.
- Component/API: typed field errors, email handoff, pending-delivery truth,
  verification actions, loading lifecycle, CSRF, rate limits, transparent
  enumeration policy, and sanitized provider errors.

## Browser journeys and evidence

Run the required Patch A journeys A-N from natural visible controls against a
production-shaped runtime. Use controlled fast, 700 ms slow, interrupted,
Back/Forward, 390x844 mobile, and reduced-motion routes. Journey N must prove one
existing account can sign in without a code and reach Personal Harbor, Player,
Captain, and Creator from the final owner database.

Capture visual evidence `HP-AUTH-PATCH-EV-A-SIGNIN` through
`HP-AUTH-PATCH-EV-M-OWNER-ACCESS-RESTORED` and temporal evidence
`HP-AUTH-PATCH-MOTION-A-FAST-NO-SPINNER` through
`HP-AUTH-PATCH-MOTION-E-BACK-FORWARD`. Each temporal receipt records source SHA,
navigation generation, sampled time, old/destination/loading visibility and
opacity, focus, bounding boxes, and transition duration.

## Aggregate gates

After exact-source focused proof, run Patch A journeys, retained Round 3
critical journeys, original Phase 7 account journeys, Phase 5 and Phase 6 gates,
Homeport/docs/catalog/format/privacy validation, production build, and Sounding
Line subsystem/mainline authority. Final publication proof separately checks
staged privacy, canonical database hash, clean worktree, local/tracking/
advertised parity, and the retained owner runtime. Raw test output is diagnostic;
only final Sounding Line `RELEASE_GO` is authority.

## Focused execution record

Exact product source `29ae357cc4df369bf33ce2dce6477618eefcbfaa` passed Patch
A journeys A-N 14/14 on one sealed production build. The retained Round 3
critical subset F, G, H, I, K, N, O, P, S, and U passed 10/10 after the current
Patch A migration was applied to fresh disposable clones. Original Phase 7
account/session journeys A, B, G, H, I, J, L, M, and N passed 9/9 after current
migrations and capability reconciliation were applied to fresh disposable
clones.

The focused Vitest set passed 103/103, the account-notice component set passed
22/22, and the final route-boundary set passed 15/15. The registration
validator passed atomicity, concurrent conflict, provider-failure, retry, and
ordinary unverified-sign-in cases. DRY_RUN, COMMIT, and VERIFY reconciliation
completed on a task-owned database with two governed repairs and zero remaining
actionable inconsistencies. All 13 required visual checkpoints received Codex
inspection; all five temporal receipts record a passing sampled-state sequence.
Postmark remains `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`.
