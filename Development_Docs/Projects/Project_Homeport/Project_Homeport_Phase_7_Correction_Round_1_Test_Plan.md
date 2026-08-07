---
title: Project Homeport Phase 7 Correction Round 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-1-test-plan
last_reviewed: 2026-08-04
---

# Phase 7 correction round 1 test plan

## Isolation

Use fixture `homeport-phase7-owner-correction-round1-v1`, a new immutable seed, fresh per-family/per-journey database
clones, task-owned storage, browser profiles, screenshots, traces, logs, ports, and receipts. The canonical database and
the returned owner-walkthrough database are forbidden targets. Destructive account tests use dedicated clones.

## Focused families

- Chronicle preview/nonmutation, signed-in default name, alias isolation/persistence, and anonymous start.
- Claimed account Player/Captain/Creator initialization, resource authorization, active-Chronicle lock/safe exit,
  same-Chronicle denial, restricted account, and multi-tab reconciliation.
- Claiming, registration, verification/resend, email sign-in/change/recovery, enumeration/rate-limit/reauth/session policy.
- Discord, Steam, and Microsoft/Xbox synthetic adapter connect/callback/collision/disconnect/unavailable/safe DTO tests.
- Export request/build/download/expiry/retry/foreign denial/no-secret archive.
- Deactivation/reactivation and deletion request/cancel/due-process/tombstone/dependency/session behavior.
- Personal Harbor hierarchy, public Profile destination, one Display Name authority, Sign Out, Data & Account, and every
  visible preference's observable effect/persistence/multi-tab/failure state.
- Loading at 100/499/500/501 ms, cancellation/error/routes; route/menu/home motion, first paint, hidden lifecycle, reduced
  motion, and performance.
- Community compact/full search, URL/Back/Forward, review summary/composer/edit/empty/moderation, responsive and privacy.

## Browser authority

Run new Journeys A through U exactly as frozen in the correction mandate using visible controls and fresh clones. Then
rerun original Phase 7 Journeys A through O against the final correction source. Cover desktop, mobile, narrow mobile,
effective 200-percent zoom, keyboard/focus, screen-reader-oriented semantics, reduced motion, fast/slow loading, failure
and recovery, privacy, and destructive clones.

## Aggregate and publication gates

Run correction ledger/architecture validation, all affected unit/API/service/component families, Phase 5 zero-orphan,
Phase 6 screen/state validation, all Phase 0-7 Homeport validators, accessibility, privacy scans, SQLite/MySQL schema and
migration rehearsals, formatter, TypeScript, ESLint, production build, Sounding Line subsystem and mainline authority,
artifact updater twice with byte identity, staged-diff privacy scan, exact-publication reruns, Git parity, canonical-DB
invariance, and final owner re-review runtime health. Only authority results of `RELEASE_GO` count as Sounding Line success.
