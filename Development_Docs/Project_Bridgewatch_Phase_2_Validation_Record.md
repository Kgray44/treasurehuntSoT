---
title: Project Bridgewatch Phase 2 Validation Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-2-validation
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 2 Validation Record

## Local qualification evidence

The following isolated focused checks passed during implementation:

- domain progress semantics: explicit weights only; low confidence is
  `UNMEASURED`; phase arithmetic does not complete a project;
- Phase 1 cache migration: old GitHub cache retained, Phase 2 durable tables
  applied once, registry upsert repeat-safe;
- Sounding Line normalization: unsupported schemas rejected; one root failure,
  31 blocked dependents, and pass-after-retry remain distinct;
- reporter: strict body, dedicated bearer token, body/query credential denial,
  clock skew, stale state, and rate limit;
- project tabs: active, completed, planned, and all predicates;
- server API: human endpoints are GET-only and the two telemetry endpoints are
  activity-only;
- browser: all lifecycle tabs work; the Project Bridgewatch biography expands;
  one authenticated activity-only heartbeat appeared in the dashboard inside
  the two-second refresh interval; and a 390x844 viewport had
  `scrollWidth == clientWidth` with all four tabs visible;
- accessibility: a local WCAG 2 A/AA scan found zero violations, including
  zero serious or critical violations;
- performance: representative 10, 25, and 50 heartbeat fixtures retained a
  warm summary response below one second;
- package qualification: 11 test files / 24 tests, package typecheck, and the
  standalone TypeScript build passed;
- governed test definition: 22 `unit.bridgewatch` case definitions across 11
  source test files, each owned by `bridgewatch` and bound to
  `bridgewatch.mission-control`; the generated registry excludes `dist` output
  and current policy validation passed.

- after the reconciliation to `ca40227cbef3575315c089d224a0cd26ec77bc78`,
  `unit.bridgewatch`, `unit.sounding-line`, `unit.feature-catalog`,
  `component.community`, and `static.core` passed against exact candidate
  `20b0b065e290201405cb78e1503fac102575232f`; `static.core` included
  repository formatting, lint, type, product-language, and architecture checks;
- repository documentation index/validation and Feature Catalog sync/validation
  passed for that exact candidate; and
- after repairing the worktree's lockfile dependency topology, the exact
  `browser.access-sentinel` and `browser.helm` families passed 3/3 each in
  isolated task-owned runtimes with clean cleanup.

These are local, task-owned package and browser observations. They are not
Sounding Line acceptance, GitHub protected-check, deployment, provider, or
owner-acceptance proof.

## Retained authority-failure repair history

- hosted run `31576357908` on `c808b7cbc796b1ebcd20b15126e22b487051321c`
  stopped at `unit.feature-catalog`: the stable-count assertion still expected
  44 entries after FT-035 added the forty-fifth. The focused Feature Catalog
  suite passed after its assertion was repaired;
- hosted run `31578682546` on `d65734b25f756ec09e291f43de1f6ac6ff9b9189`
  stopped because the Bridgewatch package cwd resolved Vitest beneath
  `bridgewatch/node_modules`, while hosted `npm ci` installs the workspace
  dependency at the repository root. The adapter now resolves the certified
  root entry point while retaining the package configuration cwd. Its exact
  focused Bridgewatch and Sounding Line suites passed locally;
- that run also recorded one `component.community` focus assertion failure.
  The exact Community test and registered component suite passed locally with
  clean cleanup; no Community source was changed.

The candidate-local mainline execution after reconciliation was not a hosted
release decision and returned two cleanly released browser lock refusals. The
smallest affected browser scopes later exposed a broken pnpm-style worktree
dependency topology (`@prisma/engines` missing in the copied seed). A
lockfile-exact `npm ci`, `npm run db:generate`, and fresh exact browser-family
qualification repaired that environment without changing tracked source.

## Canonical acceptance and exact-main proof

Hosted [Sounding Line authoritative run 31598563933](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31598563933)
finalized `RELEASE_GO` for exact candidate
`20b0b065e290201405cb78e1503fac102575232f`: all 38 mandatory receipts passed
with `CLEAN` cleanup. Its acceptance envelope bound PR #49 and base
`ca40227cbef3575315c089d224a0cd26ec77bc78`; protected binding run
`31600365805` then passed the required `Sounding Line / Mainline Decision`
context. PR #49 merged at `9b950a5fd603be27c813f9298b0b14888fbce6cf`, and a
fresh fetch proved that exact commit in `origin/main` with the candidate as its
second parent.

This is Sounding Line and protected-main acceptance. It is not deployment,
provider, or owner-acceptance proof, and it does not authorize Phase 3.
