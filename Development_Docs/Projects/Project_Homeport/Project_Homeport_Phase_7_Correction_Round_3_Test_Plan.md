---
title: Project Homeport Phase 7 Correction Round 3 Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-test-plan
last_reviewed: 2026-08-05
---

# Project Homeport Phase 7 correction Round 3 test plan

## Isolation and exact source

Use fixture `homeport-phase7-owner-correction-round3-v1`, a new immutable seed, purpose-specific browser/destructive databases, task-owned media and synthetic outbox, ports 3761-3768, independent browser profiles, and source-bound receipts under the Round 3 task root. The canonical database and preserved Round 1/Round 2 owner databases are forbidden. Any source change invalidates prior exact-source evidence.

## Focused gates

- All 54 ledger rows, 42 architecture decisions, contract docs, screen/control/journey/catalog updates, and traceability.
- Profile crop geometry, client preview cleanup, bytes/MIME/decode/pixel/animation validation, private original and derivative lifecycle, replacement atomicity, ownership/visibility IDOR, mobile/touch/keyboard/zoom.
- Registration six-digit challenge state, hash/expiry/attempt/resend/replay/concurrency/rate limits, pending-to-active activation, provider-neutral delivery, synthetic isolation, Postmark response/error and authenticated idempotent webhook handling.
- Dark anonymous/new-account/fixture first paint and stored-choice preservation without broad Light redesign.
- Workspace entry versus resource authority, new-account provisioning, existing-account reconciliation, useful Captain/Creator empty states, real active-lock and false-lock cases.
- Direct overlapping crossfade, no background-only frame, stable ProductShell, 499/500/501 ms loading integration, focus/scroll/back-forward/interruption, and reduced motion.
- Production account menu opening and closing frame/computed-style evidence plus focus and cleanup.

## Journey and evidence gates

Run new Round 3 journeys A-V, retained Round 2 A-W, Round 1 A-U, and original Phase 7 A-O against the exact new source. Capture all evidence IDs A-AD. Crop and motion evidence requires frame sequences or bounded video plus computed geometry/styles; a static screenshot cannot prove temporal behavior. Real email evidence is optional only when approved Postmark configuration exists and must never be inferred from synthetic output.

## Aggregate and publication gates

Run focused unit/API/service/component suites, SQLite and MySQL fresh/populated migrations if schema changes, zero-orphan, surface/state catalogs, accessibility, responsive/zoom/touch, privacy/security, docs, feature catalog, language, format, TypeScript, ESLint, production build, Experience Images, updater idempotence, Sounding Line subsystem/mainline, staged-diff privacy, exact-publication authority reruns, remote parity, canonical database invariance, and final owner-runtime health. Only exact-source Sounding Line `RELEASE_GO` may authorize publication; it cannot choose the owner decision.
