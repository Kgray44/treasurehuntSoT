---
title: Project Nightwatch Unattended Autonomy Hardening Implementation Record
audience: engineering
status: current
last_reviewed: 2026-08-23
---

# Project Nightwatch — Unattended Autonomy Hardening

## Scope and authority

This cutover adds bounded, objective-scoped `UNATTENDED_CONTINUATION`
delegation to Nightwatch. It implements routing and continuity only. Sounding
Line remains the sole authority for verification truth, `RELEASE_GO`, protected
binding, and landed-tree proof. Bosun remains a Nightwatch maintenance
executor.

The machine-readable policy is
[`testing/unattended-autonomy-policy.json`](../../../testing/unattended-autonomy-policy.json).
The durable envelope, action log, strategy attempts, and complete owner
escalations live in the Nightwatch SQLite ledger.

## Delivered behavior

- A standing envelope records objective identity, project/repository scope,
  delegated actions, explicit hard stops, budgets, expiry/completion, and audit
  identity.
- Owner-classified findings are recorded with a route of `AUTO_DELEGATED`,
  `DELEGATED_WITH_BUDGET`, or `TRUE_OWNER_REQUIRED`; the original finding is
  retained.
- Deterministic regeneration, candidate/base reconciliation, and policy
  identity reconciliation continue without an owner pause when covered by the
  envelope.
- Bosun can materialize a safe inherited shared-maintenance objective without
  an owner round trip. It still receives focused proof and normal Sounding Line
  acceptance.
- Strategy attempts require a changed strategy or semantic precondition.
  Unchanged retries are rejected, and a bounded repair count prevents a
  successor-maintenance chain.
- A true hard stop records the exact protected-main and candidate identities,
  root cause, delegation gap, attempted strategies, requested decision and
  consequences, and preserved work location before parking the candidate.

## Acceptance simulations

Focused Nightwatch simulations cover three unattended objectives:

1. Generated-state drift and candidate-induced policy identity reconciliation
   continue automatically.
2. A reversible, in-scope shared repair is handed to Bosun without an owner
   authorization round trip.
3. Strategy A fails, Strategy B continues, an unchanged retry is rejected, and
   budget exhaustion produces one parked owner escalation.

Additional adversarial assertions preserve branch-protection hard stops and
reject unrelated scope. Existing controller tests retain protected-main
merge-race reconciliation; no main movement becomes an automatic owner pause.
Exact local counts and the protected-integration boundary are recorded in
[`Project_Nightwatch_Unattended_Autonomy_Hardening_Simulation_Metrics.json`](Project_Nightwatch_Unattended_Autonomy_Hardening_Simulation_Metrics.json).

## Non-goals

This record does not grant Nightwatch release authority, redesign Sounding
Line, allow destructive work while unattended, or turn Project Trim context
expansion into scope expansion.
