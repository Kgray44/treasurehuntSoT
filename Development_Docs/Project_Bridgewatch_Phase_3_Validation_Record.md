---
title: Project Bridgewatch Phase 3 Validation Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-validation
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 3 Validation Record

## Current status: candidate preparation

This record distinguishes local, task-owned implementation evidence from the
still-required frozen-candidate, protected-main, and Sounding Line acceptance
evidence. It does not mark Phase 3 or Project Bridgewatch complete.

## Focused evidence

- History derivation proves project, phase, milestone, PR open/merge/close/check,
  worker start/blocked/finish, Sounding Line decision/root-failure, main,
  branch, external-gate, source-availability, idempotency, and source-clock
  skew semantics. Identical polling produces no event.
- Snapshot digests suppress capture-time and ordinary-heartbeat churn while
  retaining governed normalized state changes. Persisted payloads are bounded
  and never receive raw upstream response bodies.
- Migration tests cover a fresh database and a genuine Migration-2-shaped
  database; projects, phases, milestones, completion records, workers, runs,
  and nodes survive Migration 3 and repeat migration.
- Retention creates deterministic daily rollups before transient deletion,
  supports dry-run, rejects durable tables, preserves accepted phase records,
  and retains `SOUNDING_LINE_DECISION` events beyond the operational window.
- The isolated online-backup/restore test proves projects, history events, and
  migration state are semantically available from a restored task-owned file.
- Branch fixtures prove ahead/behind display, AMBER stale/behind attention,
  merged-branch stale exclusion, unavailable comparison handling, recurring
  root-failure context, and the no-progress-from-commit-count invariant.
- API fixtures prove bounded valid/future/invalid history behavior, filtering,
  GET-only history, and unchanged worker-only `/api/activity` semantics.
- The configured dashboard authentication, CSP, private host policy, and
  activity-only bearer telemetry boundary remain covered by server tests.

## Browser and accessibility evidence

On the task-owned local server, keyboard-visible controls and semantic event
ordering were inspected at ordinary desktop, 390x844 phone, and 1440-wide
control-room widths. At 390x844, `scrollWidth` did not exceed the available
content width; the history, archive, Attention, active projects, worker/test,
and pull-request surfaces remained reachable. At wide desktop, the project
grid used four compact columns rather than stretched cards.

The WCAG 2 A/AA Axe audit on the rendered dashboard reported 19 passing rule
groups, zero serious findings, and zero critical findings. The audit script was
injected only into the task-owned browser tab for the scan and the page was
reloaded immediately afterward; it is not shipped by Bridgewatch.

## Read-only route inventory

| Route family                                                                                                               | Allowed methods | Purpose                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `/`, static assets, `/healthz`, `/readyz`                                                                                  | GET/HEAD        | private dashboard, static presentation, liveness/readiness               |
| `/api/summary`, projects, history, trends, archive, branches, pulls, actions, workers, tests, attention, activity, sources | GET/HEAD        | bounded human observation only                                           |
| `/api/telemetry/heartbeat`, `/api/telemetry/finish`                                                                        | POST only       | existing machine activity telemetry with dedicated bearer authentication |

No Phase 3 route changes GitHub, Sounding Line, branches, tests, releases,
project lifecycle, milestones, source code, or a user acknowledgement state.

## Required candidate evidence still pending

Before this record can become an acceptance record, run the current planner's
affected qualification scope on one frozen SHA, reconcile current main if it
changes, complete cleanup, dispatch exactly one explicit `mainline` authority,
obtain a valid `RELEASE_GO` bound to that SHA, merge through protected main,
then replace pending fields in the Integration Manifest and completion receipts
with exact evidence. A local green test is not Sounding Line acceptance.
