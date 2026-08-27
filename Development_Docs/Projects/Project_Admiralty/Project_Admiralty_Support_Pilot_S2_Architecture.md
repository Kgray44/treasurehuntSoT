---
title: Project Admiralty Support Pilot S2 Architecture
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s2-architecture
last_reviewed: 2026-08-27
---

# Support Pilot S2: Turn the Wrench

## Purpose

S2 extends the accepted S1 diagnostic case only with registered, bounded owner
commands. The coordinator has no general mutation capability:

`current case -> current owner consent -> delegated repair budget -> registered preview -> owner command -> verification`

The registry is code-owned and immutable during a case. Case narrative, user
content, diagnostic evidence, and model output are never command authority.

## Enabled registry

| Command                           | Owner      | Risk | Bound                                                               |
| --------------------------------- | ---------- | ---- | ------------------------------------------------------------------- |
| `wayfarer.profile.reconcile`      | Wayfarer   | R1   | One profile-preference representation                               |
| `wayfarer.session.revoke-stale`   | Wayfarer   | R2   | One inactive-for-30-days session and at most one assurance          |
| `one-voyage.membership.reconcile` | One Voyage | R3   | One inconsistent removed membership and at most one presence record |

The requested Harborlight projection rebuild and operational job commands are
not registered in S2. Their owners do not yet expose a safe command that meets
this contract. S2 fails closed rather than creating an adapter that would
duplicate domain logic or reach private job data.

## Authority and budgets

The target owner approves exact diagnostic scopes and exact repair IDs together.
Approval derives the maximum risk class; it cannot be raised by the operator or
agent. Each short-lived `SupportExecutionGrant` stores its remaining command,
record, and domain budgets. Budget debiting, the durable execution record, and
the start audit record share one transaction before an owner command can begin.

Every proposal reloads the case, owner grant, Administrator assurance, target,
and registered preconditions. Execution repeats those checks, binds the current
case and target revision, and takes a short case-scoped lease on the mutable
target. A competing case is refused rather than silently racing.

## Failure and recovery

Every execution has an idempotency key and durable state. A duplicate delivery
returns the prior logical execution. If a process stops after a command may have
committed, the coordinator verifies canonical owner state before it ever tries
again. Verification is required for `VERIFIED_RESOLVED`; a command response
alone is not a resolution claim. S2 enabled repairs have no safe automatic
compensation, so an unproven outcome remains `VERIFICATION_INCONCLUSIVE`.

## Boundaries

S2 retains all S1 privacy exclusions. It cannot run raw SQL or shells, retrieve
secrets, read private Chronicle/media content, alter authorization/privacy
controls, rewrite audit history, hotpatch source, or call an unregistered
mutation endpoint. S2 does not begin Support Pilot S3 or Admiralty Phase 4.
