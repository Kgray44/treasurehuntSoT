---
title: Project Helm Phase 4 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-4-design-record
last_reviewed: 2026-08-28
---

# Project Helm Phase 4 design record

## Scope and governing boundary

Phase 4, **Weather the Passage**, adds a Captain-facing preflight and recovery
projection after accepted Helm P3. It makes imperfect operation legible without
creating a second Voyage state machine, writing a repair directly to the
database, or claiming that an adjacent provider is healthy when it has not
provided a contract.

The projection reads existing published-edition, membership, lifecycle,
presence, attention, event-sequence, and canonical-command facts. It provides
four preflight outcomes: `READY`, `READY_WITH_WARNINGS`, `NOT_READY`, and
`UNKNOWN_DEPENDENCY`. A missing provider contract is `UNKNOWN_DEPENDENCY`, not
a passing provider check; a provider reported unavailable is a warning and
requires safe escalation rather than a fabricated fallback.

## Recovery contract

The recovery drawer is evidence-bound to the current canonical sequence and
observation time. Its only actionable controls are existing governed Captain
commands: pause, resume, replay current presentation, and restore the prior
Passage. The server continues to derive their availability from current
authoritative state and preserves their CSRF, confirmation, reason,
idempotency, sequence-conflict, audit, and canonical-event semantics.

No Phase 4 code enables direct database mutation, a force-repair command,
provider impersonation, event fabrication, expanded Captain authorization, or
new Player/Creator disclosure. Critical conditions and unavailable providers
present an escalation step that explicitly has no mutation control.

## Operational status

An active Voyage with a warning-level connection or system condition now
projects `DEGRADED`; a high or critical condition remains `ACTIVE_ATTENTION`.
The change is a derived operational reading only. It does not alter the
canonical `TaleSession.status`, progression, membership state, or event stream.

## Explicit non-goals

- No provider-specific Drydock, Landfall, Watchglass, device, or notification
  implementation until its owned contract is available on protected main.
- No persisted preflight or recovery receipt, schema migration, or parallel
  recovery store; existing canonical command receipts and audit events remain
  the durable evidence when an action is taken.
- No P5 responsive/polish, compatibility retirement, deployment, live-Voyage,
  physical-device, external-provider, or owner-walkthrough claim.
