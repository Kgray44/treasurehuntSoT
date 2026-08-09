---
title: Project Admiralty Phase 1 Threat Model
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-1-threat-model
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 Threat Model

| Threat                                          | Control                                                                                                       | Required proof                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Hidden-route knowledge becomes privilege        | Server resolves canonical session and named capability before projection; unauthorized `/admin` is not found. | Anonymous, ordinary, revoked-role, and projection-short-circuit tests. |
| Email allowlist becomes permanent authorization | Bootstrap is explicit reconciliation only; runtime uses active `AccountRoleAssignment`.                       | Email-change and role-revocation tests.                                |
| Broad administrator bypasses consent            | Every support read validates grant operator, target, scope, expiry, and revocation.                           | IDOR, wrong-scope, wrong-target, expired, and revoked tests.           |
| Elevation replay or theft                       | Assurance has no client bearer; it is bound to account/session and rechecked against role and parent session. | Wrong-session, expired, revoked-session, and role-removed tests.       |
| CSRF causes privileged mutation/read            | Canonical session CSRF is required on assurance, support decisions, revocation, and sensitive reads.          | Missing, wrong, and valid token tests.                                 |
| Enumeration leaks privileged or private state   | Authorization precedes projection; errors are stable and safe; ordinary users cannot query admin endpoints.   | Negative route/API and sanitized-error tests.                          |
| Audit leaks secrets                             | Recursive key denylist, bounded strings/arrays/objects, field-aware summaries, and no raw object dumps.       | Nested redaction and private-content absence tests.                    |
| Audit outage permits untracked critical change  | Critical mutation and audit event share one transaction.                                                      | Forced audit failure rollback test.                                    |
| Request flooding or password guessing           | Shared platform rate limiter protects privileged endpoints with account/session keys.                         | Rate-limit tests and headers.                                          |
| Stale grant remains usable                      | Effective state is recomputed against current time and revocation on every use.                               | Expiry and immediate-revocation tests.                                 |
| Capability drift grants unknown power           | Closed runtime capability IDs; unknown and dormant items deny.                                                | Unknown/dormant resolver tests and registry validation.                |
| Migration collision or destructive upgrade      | Paired reservation, additive migrations, fresh/upgraded/parity rehearsal, current-main reconciliation.        | Schema and migration receipts.                                         |

## Trust boundaries

The browser is untrusted. Environment variables are trusted only as explicit
bootstrap input to a deliberate command. Database rows remain subject to
current session, account, role, assurance, and grant checks. External providers
do not participate in Phase 1 authorization.

## Residual risks

- Process-local rate limits are not a distributed production throttle. They are
  the current platform authority and must be replaced platform-wide before
  multi-instance enforcement is claimed.
- OAuth-only privileged reauthentication is a typed but unavailable method in
  this phase. Such accounts retain base shell access but cannot pass a
  reauthentication-required operation.
- Owner visual and wording acceptance remains external to automated proof.
