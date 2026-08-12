---
title: Testing
audience: developer
status: current
canonical_for: testing-guide
last_reviewed: 2026-08-12
---

# Testing

Project Tideglass Phase 2 is owned by the `unit.tideglass` Sounding Line
family. It covers the retained Phase 1 exact-edition contracts plus governed
classification/significance, compatibility, projection/count privacy,
deterministic summaries, immutable annotation history and attacks, cache
identity/corruption rebuild, API auth/CSRF/rate limits, and dual-provider
migration declarations. `npm run tideglass:migrations:sqlite` uses a disposable
database and is diagnostic evidence; final authority remains the exact-source
Sounding Line decision.

## Tideglass Phase 3 reproducible qualification

Use `npm run tideglass:phase3:validate` for the non-authoritative Phase 3
source contract, `npm run tideglass:phase3:fixture` for the task-owned
synthetic SQLite fixture, and `npm run tideglass:phase3:journeys` for the
visible-entry production-build browser journey. The fixture, credentials,
database, reports, screenshots, and visual manifest stay under
`%LOCALAPPDATA%\\ProjectTideglass\\phase3-qualification`; never point these
commands at canonical `prisma/dev.db`. These checks are development and local
qualification evidence only. The accepted Phase 3 product has separate
source-bound candidate and integrated-main Sounding Line receipts. Do not invoke
Sounding Line to discover defects;
the single Mainline Decision is reserved for the reconciled, frozen,
owner-accepted candidate.

Run focused unit or route tests while changing a domain. Before review, run
formatting, lint, type checking, unit tests, private-content scanning,
documentation validation, and Feature Catalog checks as the environment
permits. `npm run validate` is the repository's complete gate.

Browser tests require isolated database and runtime configuration. A skipped
external provider check is not a passing production proof. The
`P34-BME-20260729` risk acceptance is a blocked browser-matrix exception, not
a complete matrix pass; retain that distinction in validation evidence. Record
environment limitations in engineering evidence, not in current user guides.

Run `npm run test:oauth` for the isolated Google and GitHub desktop/mobile
browser lane. It creates a task-owned temporary SQLite database, enables the
non-production simulator, and exercises canonical account creation, returning
sign-in, sessions, logout, password compatibility, email collision, explicit
linking, cancellation, and invalid-state handling. It is synthetic protocol and
product integration evidence, not a live provider authorization.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 retains task-owned synthetic email for automated isolation and
selects Resend for explicit live-provider acceptance. Synthetic proof must never
be reported as Resend or inbox proof. Owner Re-Review Round 3 remains
`PENDING_OWNER_DECISION`.

## Phase 7 correction Round 3 Patch A

Use the Patch A task root, fixture, isolated databases, synthetic outbox, and
sealed production build for registration or transition validation. Temporal
route evidence must sample generation, layers, opacity, loading, focus, and
background-only state; screenshots alone cannot prove the absence of a delayed
flash. Never run the reconciliation command against canonical `prisma/dev.db`.

For host-origin regressions, run `npm run homeport:origin:test`. It must pass on
both direct loopback and an exact reverse-proxy hostname and verify hydration,
current-user bootstrap, click behavior, keyboard focus/typing, route navigation,
settled overlays, and sanitized forwarding metadata. This automated lane does
not replace protected-staging desktop or physical-phone acceptance.
