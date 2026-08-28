---
title: Project Admiralty Support Pilot S3 Test Plan
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s3-test-plan
last_reviewed: 2026-08-28
---

# Support Pilot S3 Test Plan

All acceptance uses task-owned synthetic accounts and databases.

- Domain: only the opening operator can close an active case; terminal cases
  are fail-closed, duplicate closure is idempotent, and active diagnostic or
  repair executions block finalization.
- Authority: the HTTP route requires signed-in `SUPPORT_USE`, CSRF, recent
  privileged assurance, a bounded safe reason, and rate limiting.
- Revocation: a pending request is cancelled; active parent and delegated
  grants are revoked before the case becomes `CLOSED`.
- Browser: the task-owned S3 journey opens and receives owner consent for a
  read-only case, completes diagnosis, closes it, observes `CLOSED` and
  `REVOKED`, confirms further diagnosis is unavailable, and runs Axe.
- Platform: generated Prisma client, focused unit/component tests, lint,
  TypeScript, documentation/catalog validation, and ordinary protected gates.

Live-provider, private-data, mobile, reduced-motion, keyboard-only, and
physical assistive-technology acceptance remain outside synthetic proof.
