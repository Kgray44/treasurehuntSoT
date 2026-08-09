---
title: Project Admiralty Phase 1 Test Plan
audience: product-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-1-test-plan
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 Test Plan

## Focused contracts

1. Capability resolution: administrator, ordinary, Captain, Creator, scoped and
   duplicate roles, revoked roles, unknown capabilities, and dormant registry
   items.
2. Bootstrap: account ID and exact email resolution, nonexistent account,
   duplicate/idempotent reconciliation, revocation followed by explicit
   reconciliation, ambiguity fail-closed, and audit rollback.
3. Route: anonymous, ordinary, and revoked administrators denied before
   projection; active administrator allowed; no ordinary navigation entry.
4. Assurance: fresh, expired, wrong session, revoked parent session, failed
   password, superseded assurance, and role removal.
5. Support request/grant: create, approve, deny, cancel, expire, revoke,
   duplicate decision, invalid/forbidden scope, wrong target/operator/scope,
   and immediate revocation.
6. Audit/privacy: mutation and sensitive-read evidence, stable correlation,
   recursive redaction, bounded summaries, no credential/token/private content,
   and critical audit failure rollback.
7. API: stable status/code contract, CSRF missing/wrong/valid, rate limiting,
   validation, IDOR, and sanitized errors.

## Migration proof

- Prisma validates and generates against SQLite and MySQL schemas.
- A fresh copied SQLite database migrates from zero.
- An isolated database at the prior migration head upgrades without row loss.
- Repeated bootstrap reconciliation is idempotent.
- Model/index/column parity is compared across SQLite and MySQL definitions.

No canonical development or staging database is modified.

## Browser and accessibility proof

Synthetic administrator, ordinary, and support-target accounts cover direct
admin denial, authorized shell, password reauthentication, request approval,
scoped read, denial, and revocation. The Support Access consent surface is
checked at desktop and narrow viewport, keyboard-only operation, reduced motion,
effective 200 percent zoom, and automated accessibility scanning.

## Authoritative gates

Focused raw tests are diagnostic. Final technical disposition comes from the
accepted Sounding Line command selected for the changed source, followed by
documentation, feature-catalog, privacy, build, and current-main reconciliation
evidence. Human-facing acceptance remains a separate owner walkthrough.
