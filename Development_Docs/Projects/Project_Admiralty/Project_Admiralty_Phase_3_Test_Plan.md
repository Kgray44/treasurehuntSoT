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
  audit failure and stale lifecycle revision fail closed. Wayfarer persists a
  receipt keyed by idempotency key inside the same owner transaction; matching
  retries return that original normalized result without another mutation.
- Migration rehearsal: an isolated SQLite baseline upgrades through
  `20260813130000_admiralty_phase3_wayfarer_command_receipts`, preserves a
  sentinel account, and confirms the receipt table on upgraded and fresh
  databases.
- Moderation: Harborlight owner preview/action lifecycle and transaction-bound
  audit composition, case-attached target projection, endpoint error
  normalization, owner-enforced distinct-second-review eligibility, and a
  constrained Community action panel.

## Qualification result

The focused owner-service suite covers audit failure, stale revision,
idempotency, authorization, and second-review eligibility. The isolated
Chromium suite covers the three qualified commands through preview, assurance,
confirmation, receipt persistence, privacy, serious/critical Axe checks, an
authenticated CSRF denial, and a moderation-operator Operations-station denial. Its
development-server fallback is explicitly limited by the unrelated full
repository TypeScript blocker; it does not certify a production build.
Job, role, and configuration mutation tests remain blocked until their canonical
owner command contracts exist; they are not interpreted as passing by absence.
