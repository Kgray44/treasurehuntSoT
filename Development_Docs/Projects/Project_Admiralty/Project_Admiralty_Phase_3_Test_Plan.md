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
  endpoint controls, endpoint error normalization, and a dossier action panel.
- Account suspension: expected-revision and owner transaction controls,
  endpoint error normalization, and a dossier lifecycle action panel.
- Owner transaction tests: session invalidation composes related privileged
  assurance invalidation, a redacted security event, and administrative audit;
  audit failure and stale lifecycle revision fail closed.
- Moderation: Harborlight owner preview/action lifecycle and transaction-bound
  audit composition.

## Qualification still required

Add isolated owner-service, audit-failure, durable duplicate receipt,
stale-preview, CSRF, IDOR, privacy, accessible UI, and browser journeys for
each partially implemented command.
Job, role, and configuration mutation tests remain blocked until their canonical
owner command contracts exist; they are not interpreted as passing by absence.
