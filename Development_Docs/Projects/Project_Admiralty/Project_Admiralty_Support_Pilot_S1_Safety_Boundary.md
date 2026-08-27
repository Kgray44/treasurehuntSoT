---
title: Project Admiralty Support Pilot S1 Safety Boundary
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s1-safety-boundary
last_reviewed: 2026-08-27
---

# Support Pilot S1 Safety Boundary

## Read-only invariant

S1 may create support-control and audit records needed to represent a case and
its evidence. It must not mutate the user or platform truth it observes. A
diagnostic execution has the `READ_ONLY` risk ceiling and no command port.

## Consent invariant

The account owner must approve an active, exact, scope-bound Support Access
grant before diagnosis. The parent grant must be linked to the case request,
belong to the initiating operator, target the same account, include the selected
scope, and remain unexpired and unrevoked. Every mismatch is denied and leaves
a denial audit/session record without revealing data.

## Data invariant

Private Chronicle content and media are excluded by default. Passwords, hashes,
session/OAuth tokens, CSRF values, provider secrets, encryption keys, raw logs,
arbitrary SQL, filesystem access, and shell access are unrepresentable in the
request schema and unavailable through diagnostics.

## Evidence invariant

S1 stores source type/reference, data classification, a safe summary, a digest,
and redaction state. It does not store an inspected raw payload merely because a
diagnostic reader handled it. Findings reference evidence records and receipt
digests instead of copying source payloads.

## Mutation exclusion matrix

| Excluded action                    | S1 disposition  |
| ---------------------------------- | --------------- |
| Account or user-state correction   | No command path |
| Session revocation                 | No command path |
| Voyage or Community mutation       | No command path |
| Job retry or projection rebuild    | No command path |
| Configuration mutation             | No command path |
| Repair registry or action executor | Deferred to S2  |
| Cross-case/systemic intelligence   | Deferred to S3  |
