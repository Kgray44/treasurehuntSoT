---
title: Project Admiralty Phase 3 Job Operations Architecture
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-job-operations
last_reviewed: 2026-08-13
---

# Phase 3 job operations architecture

Job controls are owner-scoped. The accepted Community outbox exposes only
worker claim/failure transitions; it does not expose a safe administrator
retry, requeue, or cancellation operation. Admiralty therefore renders no job
mutation control and records `BLOCKED_BY_MISSING_OWNER_CONTRACT`. Private
content jobs are additionally excluded by the Phase 4 boundary.
