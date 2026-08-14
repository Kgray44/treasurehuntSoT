---
title: Project Bridgewatch Phase 3 Validation Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-validation
last_reviewed: 2026-08-13
---

# Project Bridgewatch Phase 3 Validation Record

## Status: ACCEPTED INTO MAIN

This record distinguishes retained diagnostic evidence from accepted
protected-main evidence. Phase 3 implementation candidate
`5bae2e4d2d0aee6993f8e619cc8c79ef99235ff6` was accepted by Sounding Line
mainline authority `31718170750` with `RELEASE_GO`, 38 mandatory `PASSED` and
`CLEAN` receipts, and protected binding `31719929034`; it merged at
`dead22dc26aeec2b722625aa9a68dc5688111fca`. The required source-indexed
lifecycle correction then received its own exact authority `31720843942`,
`RELEASE_GO`, 38 clean mandatory receipts, and protected binding `31722507891`;
it merged at `d6eb335880376f59403cf7108bf26690d8da4891`. The Project Registry
now records Phase 3 and Project Bridgewatch as `COMPLETE` only from that
accepted evidence.

The implementation branch was
`codex/project-bridgewatch-phase3-keep-the-watch-6`, replayed onto protected
main `60b89841986e66fbc2c0828489d38002a1617506` after the accepted Tideglass
Phase 3 reconciliations. The prior `-4` candidate
`efd574010a7bcf5533d50c28799fc661bd719697` is preserved with its valid
`RELEASE_GO` authority `31665028258` only for base
`25a5ecc3989d137a95291c340f07143860b821cc`; it is not reused as current-candidate
acceptance evidence. The intermediate `-5` candidate `7aca79b9...` produced
one hosted-only, non-reproducing `component.studio` invalid receipt in run
`31668485208`; it was not retried and is likewise not acceptance evidence.
The intervening current-main changes are accepted reconciliation, completion,
and Feature Catalog records; they do not change Bridgewatch source, schema,
registry, or migration paths.

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
- On the implementation candidate, `npm --prefix bridgewatch run validate` and
  `npm --prefix bridgewatch run build` passed: TypeScript plus 15 Vitest files
  / 41 tests. The concise recent-change selector test proves branch/source
  polling context is suppressed, governed events dedupe by entity, and the
  compact panel remains bounded. The realistic performance test has an explicit 15-second test
  harness ceiling while retaining its stricter one-second query and
  five-second retention product assertions.
- Current-main static qualification passed: `docs:validate`,
  `features:validate`, `test:policy`, `test:inventory`, `lint` (0 errors; the
  repository's existing warnings only), and `format:check`.
- After the Tideglass-current-main replay, `npm --prefix bridgewatch run
validate` and `npm --prefix bridgewatch run build` again passed: 15 files /
  41 tests and TypeScript. Current `docs:validate`, `features:sync` /
  `features:validate`, `test:policy`, `test:inventory`, `format:check`, root
  TypeScript, product-language, and One Voyage architecture checks passed. A
  final clean exact-SHA check remains required immediately before dispatch.

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

On the `-6` replay, the task-owned local runtime again served the complete
dashboard without browser-console errors. The phone viewport had no horizontal
overflow, the completed archive tab and its chronological/name controls were
reachable, and the wide layout retained four approximately 323px columns.
Keyboard traversal reached the Since-last-visit button with a solid visible
outline. These checks exercised display state only; they did not acknowledge
events or mutate upstream systems.

## Authority failure and focused repair evidence

The first exact-source mainline authority for PR #83, run `31714713467`,
tested `e960db8c64133ac514aa4c63e652f0f3eb891b95` against base
`60b89841986e66fbc2c0828489d38002a1617506`. Its finalizer decision was
`EVIDENCE_INVALID`: 37 of 38 mandatory receipts passed and every receipt
reported `CLEAN` teardown, but `browser.helm` failed. The failing first
Captain/Player invitation journey could not find the expected **Accept and
Join Voyage** button at the 10-second enabled-state assertion. This is a
Helm-owned product journey, not a Bridgewatch surface; no Bridgewatch source
was changed in response and the failed authority was not retried.

The required smallest-scope reproduction was then completed in two independent
task-owned contexts on the unchanged source. The local isolated
`browser.helm` execution passed all 3 registered cases with runtime
conformance `PASSED`, `CLEAN` teardown, and no remaining resource lease or
orphan. Hosted focused repair run `31716941169` then passed the same 3/3
registered cases on the same SHA with `CLEAN` teardown and runtime conformance
`PASSED` (duration 412,217 ms). This establishes a non-reproducing hosted
failure, not an accepted release decision. A fresh candidate incorporating
this evidence must be qualified and frozen before the one permitted new
mainline authority attempt.

## Read-only route inventory

| Route family                                                                                                               | Allowed methods | Purpose                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `/`, static assets, `/healthz`, `/readyz`                                                                                  | GET/HEAD        | private dashboard, static presentation, liveness/readiness               |
| `/api/summary`, projects, history, trends, archive, branches, pulls, actions, workers, tests, attention, activity, sources | GET/HEAD        | bounded human observation only                                           |
| `/api/telemetry/heartbeat`, `/api/telemetry/finish`                                                                        | POST only       | existing machine activity telemetry with dedicated bearer authentication |

No Phase 3 route changes GitHub, Sounding Line, branches, tests, releases,
project lifecycle, milestones, source code, or a user acknowledgement state.

## Final acceptance evidence

The implementation finalizer was intentionally not used as a debugger. The
earlier Helm browser receipt was preserved as invalid historical evidence, the
smallest focused reproduction passed, and the fresh candidate was qualified,
frozen, accepted once on its exact SHA, and protected-merged. The later
registry-only lifecycle correction also received fresh exact-SHA qualification,
one authority decision, and its protected merge. The Integration Manifest and
completion receipts now hold those exact identities; focused green evidence is
not represented as an authority substitute.
