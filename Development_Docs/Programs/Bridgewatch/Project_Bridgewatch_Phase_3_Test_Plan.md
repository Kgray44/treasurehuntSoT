---
title: Project Bridgewatch Phase 3 Test Plan
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-test-plan
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 3 — Test Plan

## Scope

This plan qualifies **Keep the Watch** without treating activity as progress or
using the authoritative mainline gate as a development debugger. Focused
Bridgewatch tests run after each seam. The final candidate uses the current
Sounding Line planner and the affected Bridgewatch suites.

| ID            | Requirement seam                                                                   | Tier / owner               | Evidence and expected result                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BW3-EVENT     | Project, phase, milestone, PR, worker, Sounding Line, main, and branch transitions | unit / Bridgewatch         | One deterministic normalized event per transition; identical poll emits none; source and observation timestamps remain separate.                                                      |
| BW3-SNAPSHOT  | Digest, cadence, and payload bounds                                                | unit / Bridgewatch         | First and changed normalized snapshots persist; capture/heartbeat-only churn does not; payload is bounded and contains no raw upstream response.                                      |
| BW3-MIGRATE   | Fresh and Phase 2 to 3 migration                                                   | integration / Bridgewatch  | Migrations 1–3 apply once; a genuine Phase 2-shaped database retains projects, phases, milestones, completion record, workers, runs, and nodes.                                       |
| BW3-RETENTION | Rollup, dry run, prune, durable guard, compaction policy                           | integration / Bridgewatch  | Rollup exists before deletion; a dry run changes no rows; repeated prune is idempotent; durable tables are rejected as targets.                                                       |
| BW3-CANARY    | Old accepted project survival                                                      | integration / Bridgewatch  | Expired telemetry is pruned while accepted project/phase/milestone/receipt/mainline evidence remains.                                                                                 |
| BW3-API       | History, trend, archive, project history, and branch projection                    | API / Bridgewatch          | GET-only bounded responses validate timestamps, range, filter, cursor, and ordering; `/api/activity` remains worker activity.                                                         |
| BW3-BRANCH    | Ahead/behind, age, merge state, and attention                                      | unit/API / Bridgewatch     | Active materially-behind or stale branches are AMBER; merged historical branches are not stale; commit count cannot alter governed milestone progress.                                |
| BW3-ARCHIVE   | Completed archive and phase timeline                                               | API/browser / Bridgewatch  | Chronological and name ordering, accepted main identifiers, decisions, and missing timestamps are accurate; no live-worker fiction.                                                   |
| BW3-VISIT     | Browser-local last visit                                                           | browser / Bridgewatch      | Valid cursor requests interval; absent, invalid, future, unavailable local storage fall back to 12 hours; cursor never mutates server truth.                                          |
| BW3-RECENT    | Since-last-check prioritization                                                    | unit/browser / Bridgewatch | Governed lifecycle, blocker, validation, mainline, PR, and milestone transitions are concise; repeated entities dedupe, branch/source polling context stays out of the compact panel. |
| BW3-A11Y      | Keyboard, semantics, motion, phone, wide display                                   | browser/axe / Bridgewatch  | 390×844 and wide desktop have no essential horizontal overflow; focus, status text, chronological DOM, and reduced-motion behavior work; serious/critical Axe findings are zero.      |
| BW3-PERF      | Representative history fixture and retention                                       | performance / Bridgewatch  | Dozens of projects, 30-day events, 90-day rollups, recent test nodes, and 10/25/50 workers stay within the documented response and storage budget.                                    |
| BW3-BACKUP    | SQLite backup and restore                                                          | integration / Bridgewatch  | Task-owned backup restores durable records, snapshots, events, rollups, and current projection semantically.                                                                          |
| BW3-OUTAGE    | GitHub, Sounding Line, and history-writer failures                                 | unit/API / Bridgewatch     | Cached source state remains labelled stale/unavailable; no completion is inferred; history failure does not blank the board.                                                          |

## Current focused commands

```powershell
npm --prefix bridgewatch run typecheck
npm --prefix bridgewatch test -- history.test.ts store.test.ts server.test.ts
npm --prefix bridgewatch run history:inspect
```

The final qualification command list is generated from current Sounding Line
policy at candidate freeze. This document does not substitute remembered suite
names for that planner output.
