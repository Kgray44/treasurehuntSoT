---
title: Project Bridgewatch Phase 3 Validation Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-validation
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 3 Validation Record

## Current status: current-main candidate preparation

This record distinguishes local, task-owned implementation evidence from the
still-required frozen-candidate, protected-main, and Sounding Line acceptance
evidence. It does not mark Phase 3 or Project Bridgewatch complete.

The current task-owned branch is
`codex/project-bridgewatch-phase3-keep-the-watch-4`, first replayed after the
accepted Helm browser correction and the user-ordered Deepwater record-only
closure, then rebased onto protected main
`25a5ecc3989d137a95291c340f07143860b821cc` after Shipwright Phase 2 merged.
Shipwright changed no Bridgewatch source, schema, registry, or test-definition
path. The prior Bridgewatch authority run remains historical external-failure
evidence and is not reused for this candidate.

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
- On this current-main candidate, `npm --prefix bridgewatch run validate` and
  `npm --prefix bridgewatch run build` passed: TypeScript plus 15 Vitest files
  / 41 tests. The concise recent-change selector test proves branch/source
  polling context is suppressed, governed events dedupe by entity, and the
  compact panel remains bounded. The realistic performance test has an explicit 15-second test
  harness ceiling while retaining its stricter one-second query and
  five-second retention product assertions.
- Current-main static qualification passed: `docs:validate`,
  `features:validate`, `test:policy`, `test:inventory`, `lint` (0 errors; the
  repository's existing warnings only), and `format:check`.

## Browser and accessibility evidence

On the current-main task-owned local server, keyboard-visible controls and
semantic event ordering were inspected at ordinary desktop, 390x844 phone, and
1440x900 control-room widths. A phone-width regression was found and repaired:
long branch identifiers could force attention/list cards beyond the viewport.
Those cards now use `min-width: 0` plus safe identifier wrapping. At 390x844,
the final rendered `scrollWidth` equaled the client width (no horizontal
overflow); the history interval, lifecycle tabs, archive, Attention, active
projects, worker/test, and pull-request surfaces remained reachable. At wide
desktop, the project grid used four 323px compact columns rather than stretched
cards. The last-visit control displayed a browser-local timestamp without
server-side acknowledgement mutation.

The current WCAG 2 A/AA Axe audit on the rendered dashboard reported zero
violations (therefore zero serious and zero critical findings). Reduced-motion
emulation produced `0s` transition/animation duration and automatic scrolling;
visible keyboard focus remained present. The audit script was injected only
into the task-owned browser tab for the scan and the page was reloaded
immediately afterward; it is not shipped by Bridgewatch.

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
