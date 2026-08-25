---
title: Project Admiralty Phase 3 Design Record
audience: product-owner-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-command-model
last_reviewed: 2026-08-13
---

# Project Admiralty Phase 3 design record

## Decision

Phase 3 uses one typed command envelope for all mutation families. A command
is previewed against fresh owner state, authorized again at execution, supplied
with a bounded human-readable reason and stable idempotency key, then delegated
to a narrow canonical owner command port. The final receipt correlates the
Admiralty audit event and owner receipt without carrying secrets or raw domain
payloads.

## Command model

The implementation models risk as `LOW`, `MODERATE`, `HIGH`, or `CRITICAL`,
and outcomes as `PREVIEWED`, `AUTHORIZED`, `EXECUTING`, `SUCCEEDED`, `FAILED`,
`CONFLICTED`, `PARTIALLY_SUCCEEDED`, or `COMPENSATING`. Every request identifies
the command, actor, target, expected revision when relevant, reason,
idempotency key, and request time. Every preview identifies current and
resulting safe state, consequences, warnings, required capability, assurance,
audit behavior, and rollback or compensation. Every receipt identifies the
owner domain, outcome, owner receipt where available, correlation ID, and
completion time.

## Ownership split

Admiralty is the orchestration boundary. Wayfarer owns account, role, session,
and recovery state. Harborlight owns Community moderation state. Each job owner
owns retry/cancel/requeue state. Configuration owners own setting type,
validation, effective value, and application. A missing owner command is
registered as `BLOCKED_BY_MISSING_OWNER_CONTRACT`; it is never replaced with an
Admiralty data write.

## Failure behavior

Stale preview returns a safe conflict. A command may be marked implemented only
when its owner supplies durable idempotency semantics that return the original
owner result on retry; the present session, lifecycle, and moderation command
families remain partially implemented while that family-level evidence is
completed. Missing assurance, CSRF, capability, audit, or owner availability
fails closed. The UI refreshes the authoritative read projection after success
and presents a bounded, actionable error after failure.
