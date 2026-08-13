---
title: Project Admiralty Phase 3 Test Plan
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-test-plan
last_reviewed: 2026-08-13
---

# Phase 3 test plan

## Implemented command foundation

- Command model: reason validation, idempotency-key shape, risk/assurance
  policy, preview normalization, and receipt normalization.
- Authorization: role partitions deny cross-family authority.
- Session revocation: Wayfarer owner transaction, CSRF/capability/assurance
  endpoint controls, and Phase 2 dossier regression coverage.
- Account suspension: expected-revision and owner transaction controls.
- Moderation: Harborlight owner preview/action lifecycle and transaction-bound
  audit composition.

## Qualification still required

Add isolated owner-service, audit-failure, duplicate, stale-preview, CSRF,
IDOR, privacy, accessible UI, and browser journeys for each implemented command.
Job, role, and configuration mutation tests remain blocked until their canonical
owner command contracts exist; they are not interpreted as passing by absence.
