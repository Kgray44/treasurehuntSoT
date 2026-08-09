---
title: Project Admiralty Phase 1 Safety Boundary
audience: product-engineering-security-support
status: current
canonical_for: project-admiralty-phase-1-safety-boundary
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 Safety Boundary

## Permitted in Phase 1

- Resolve named administrative capabilities from active canonical role assignments.
- Explicitly reconcile an existing trusted account to `ADMINISTRATOR`.
- Create session-bound, expiring privileged assurance after password reauthentication.
- Request, approve, deny, cancel, expire, use, and revoke scoped Support Access.
- Project bounded account, auth-event, history-metadata, Community-activity,
  session-diagnostic, and Profile-diagnostic facts.
- Record sanitized administrative evidence in `PlatformAuditEvent`.
- Show safe current-operator, environment, application, registry, Support Access,
  and audit summaries in the limited shell.

## Never permitted through ordinary Support Access

- Passwords or password hashes
- Session cookies, CSRF values, or raw session tokens
- OAuth access, refresh, provider, or linking secrets
- Provider secret keys or encryption master/package keys
- Private Chronicle prose, reflections, Memory bodies, answers, or private media
- Whole Prisma objects, database dumps, raw request bodies, or stack traces

The scope registry cannot express those categories. Adding such a category is a
future governed privacy and security decision, not a configuration toggle.

## Fail-closed operations

Bootstrap, Support Access request/decision/revocation, assurance creation, and
sensitive Support Access reads require authorization, CSRF where mutating or
sensitive, rate limits, validation, and canonical audit evidence. If the audit
write in a critical transaction fails, the state change does not commit.

## Immediate invalidation

Assurance and Support Access checks are evaluated at use time. A revoked or
expired parent session, restricted account, revoked role, wrong operator, wrong
target, wrong scope, expired request/grant, or revoked grant is denied without
falling back to a broad administrator role.

## Operational truth boundary

Local, synthetic, browser-harness, migration-rehearsal, and Sounding Line proof
do not establish deployment, live-provider behavior, production database
behavior, owner acceptance, or physical-device acceptance.
