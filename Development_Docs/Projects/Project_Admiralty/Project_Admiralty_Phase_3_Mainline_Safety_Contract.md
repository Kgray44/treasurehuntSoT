---
title: Project Admiralty Phase 3 Mainline Safety Contract
audience: product-owner-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-mainline-safety
last_reviewed: 2026-08-13
---

# Project Admiralty Phase 3 mainline safety contract

## Permanent plateau

If Admiralty stops after Phase 3, the integrated product remains coherent with
the accepted Phase 1 authority and Phase 2 read-only Chartroom, plus bounded
governed operations for accounts, sessions/security, Community moderation,
owner-scoped jobs, and typed configuration. Each mutation is an explicit
command routed to its canonical owner; Admiralty owns authorization, recent
assurance, reason capture, preview, confirmation, audit composition, and safe
receipt presentation.

## Invariants

- Admiralty performs no direct business-state Prisma mutation.
- Every high or critical command requires fresh privileged assurance and
  server-side CSRF/capability checks.
- Every meaningful command is reasoned, idempotent, revision-aware where its
  owner supports it, correlated, audited, and redacted.
- Owner unavailability, stale state, missing audit persistence, and missing
  owner contracts fail closed without a database fallback.
- Private content, raw payloads, token material, secret values, credentials,
  Phase 4 controls, and generic data editing remain unavailable.
- Phase 1 and 2 read paths remain read-only, stable, and independently
  authorized.

## Explicit exclusions

Phase 3 does not add Chronicle or Voyage operations, private-content repair,
feature or beta flags, maintenance activation, deployment/release actions,
backup restore, database repair, garbage collection, emergency impersonation,
or secret access. Those boundaries are product behavior, not merely hidden UI.
