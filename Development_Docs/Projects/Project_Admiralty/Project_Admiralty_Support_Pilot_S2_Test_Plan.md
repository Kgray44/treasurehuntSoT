---
title: Project Admiralty Support Pilot S2 Test Plan
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s2-test-plan
last_reviewed: 2026-08-27
---

# Support Pilot S2 Test Plan

All acceptance uses task-owned synthetic accounts and databases.

- Registry policy: R1 and R2 authorization, R3 exact consent, R4 human gate,
  RX prohibition, unknown-command refusal, scopes, capability, assurance,
  ceiling, command, record, domain, expiry, and cancellation budgets.
- Owner operations: profile representation reconciliation, stale-session
  revocation, and inconsistent removed-membership normalization with their
  bounded postconditions.
- Coordinator: proposal revision, target revision, duplicate idempotency,
  target lease conflict, revoked consent, audit-before-mutation, ambiguous
  restart reconciliation, and verification-only resolution state.
- Browser: owner sees the exact named repair before approving; the synthetic
  desktop journey gives the operator a mutation preview and takes an R1
  execution to `VERIFIED_RESOLVED`, with an automated Axe scan.
- Platform: SQLite and MySQL schema validation, TypeScript, targeted tests,
  docs, Feature Catalog, and the ordinary protected-main gates.

Unperformed production MySQL, live-provider, private-data, mobile,
reduced-motion, keyboard-only, and physical assistive-technology acceptance
remain explicitly outside synthetic proof.
