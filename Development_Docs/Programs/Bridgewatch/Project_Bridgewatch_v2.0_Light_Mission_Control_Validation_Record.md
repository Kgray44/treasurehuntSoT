---
title: Project Bridgewatch v2.0 Light Mission Control Local Validation Record
audience: engineering
status: accepted-mainline
canonical_for: project-bridgewatch-v2-light-mission-control-local-validation
last_reviewed: 2026-08-30
---

# Project Bridgewatch v2.0 — Light Mission Control Local Validation Record

## Scope and acceptance boundary

This record captures the local implementation evidence for the accepted v2.0
Phase 3 Light Mission Control scope. It preserves the accepted Bridgewatch
P1/P2 plateau and does not reopen the historic Phase 1–3 program or create a
Bridgewatch Phase 4. The exact protected-main authority is recorded in the
[completion receipt](Project_Bridgewatch_v2.0_Light_Mission_Control_Completion_Receipt.md).

## Local implementation evidence

- `pnpm --dir bridgewatch run validate` passed TypeScript plus 23 Vitest files
  / 78 tests, including the new source-bound attention and Mission Control UI
  contracts. The representative load test was also repeated in isolation after
  one shared-worker timing observation and passed all 4 cases without changing
  its under-one-second assertions.
- `pnpm --dir bridgewatch run build` passed.
- The focused root `src/admiralty/bridgewatch-gateway.test.ts` suite passed 7
  tests after adding only the read-only `facts`, `coverage`, and `nightwatch`
  routes and fact profile to the capability-gated Voyagewright and NGINX
  allowlists. Mutation, telemetry, traversal, arbitrary paths, browser
  credentials, and request-selected upstreams remain denied.
- An integration call through the current Voyagewright gateway handler to the
  task-owned live Bridgewatch listener returned `200` for the facts projection
  (12 retained fact records) and Nightwatch projection (`UNAVAILABLE`), with
  no mutation path involved.

## Task-owned live stack evidence

The task-owned loopback service on `127.0.0.1:48529` used the current worktree,
an isolated SQLite cache, real local repository discovery, and the locally
available Voyagewright runtime-status file. `/healthz` returned `ok` and
`READ_ONLY`; the current-main fallback reported
`e1a8d7eb1a6280bd3a6384070be519a72e0d9674` from local Git observation.

The live sources view visibly retained the actual degraded state: GitHub was
`UNAVAILABLE` after a `403` response, telemetry and approved provider/job
projection were `NOT_CONFIGURED`, and the observed runtime identity remained
`PROVISIONAL` rather than being treated as deployed-main proof. These conditions
generated attributed attention cards and expected-fact coverage gaps instead of
being hidden or converted into a synthetic health score.

Browser acceptance exercised all eleven stations, project navigation to the
real Bridgewatch profile, bounded provenance search, Mainline current-main
display, History's bounded request and controls, source coverage, Attention,
and 390x844 mobile rendering. The mobile page had no document-level horizontal
overflow and its eleven station links remained present. The browser console
reported no errors during acceptance.

## Accessibility evidence

Axe scanned the live task-owned desktop Project profile at 1440x900 and the
mobile Sources & Data Quality station at 390x844. Both scans reported zero
violations, including zero serious and zero critical findings. The repaired
mobile table regions are named, focusable horizontal-scroll regions; live
browser checks also confirmed labelled inputs, table headers, station
navigation, and the polite route-change region.

## Unperformed acceptance

This local record does not assert a shared private deployment, authenticated
operator session, provider recovery, GitHub availability, or physical
production runtime. Those remain deliberately distinct from the accepted
protected-source integration.
