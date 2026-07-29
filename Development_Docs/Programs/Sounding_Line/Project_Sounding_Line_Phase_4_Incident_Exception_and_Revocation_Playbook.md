---
title: Project Sounding Line Phase 4 Incident Exception and Revocation Playbook
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-incident-playbook
last_reviewed: 2026-07-29
---

# Phase 4 Incident, Exception, and Revocation Playbook

## Incident classes and mandatory flow

The future incident classes are `PLANNER_DEFECT`, `MISSING_TEST_SELECTION`,
`WORKER_COMPROMISE`, `EVIDENCE_TAMPERING`, `CLEANUP_ESCAPE`,
`CANONICAL_DATA_MUTATION`, `SECRET_EXPOSURE`, `INCORRECT_RELEASE_DECISION`,
`CI_POLICY_DIVERGENCE`, and `LEGACY_SOUNDING_LINE_DISAGREEMENT`.

Every class follows: detect and preserve evidence; immediately stop affected
dispatch; classify source/policy/worker scope; revoke affected receipts; roll
back authority or use emergency serial where warranted; investigate; repair;
revalidate complete affected scope; and obtain authorized resumption. A release
with affected invalid evidence is not grandfathered. Canonical-data mutation or
secret exposure additionally invokes the owning security/data response process.

## Time-bound exceptions

An exception record names owner, scope, reason, compensating evidence, risk,
start, expiry, release effect, approval, and removal criteria. It is
non-transferable, cannot weaken mandatory privacy/authorization/migration/
lifecycle/accessibility requirements without an explicit release effect, and
expires automatically. A recurring or extension-only exception is a defect to
remediate, not a permanent exception disguised as temporary.
