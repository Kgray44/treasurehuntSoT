---
title: Project Admiralty Phase 3 Mutation Risk Matrix
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-mutation-risk
last_reviewed: 2026-08-13
---

# Phase 3 mutation risk matrix

| Family | Risk | Assurance | Owner | Current disposition |
| --- | --- | --- | --- | --- |
| Session revoke | HIGH | Required | Wayfarer | Implemented |
| Account suspension | CRITICAL | Required | Wayfarer | Implemented |
| Role assignment | CRITICAL | Required | Wayfarer | Blocked pending owner command |
| Moderation action | CRITICAL | Required | Harborlight | Implemented |
| Job control | HIGH | Required | Job owner | Blocked pending owner command |
| Configuration | HIGH | Required | Configuration owner | Blocked pending typed contract |

Every implemented command requires server authorization, CSRF, a bounded
reason, idempotency key, fresh authoritative preview, audit, and safe receipt.
