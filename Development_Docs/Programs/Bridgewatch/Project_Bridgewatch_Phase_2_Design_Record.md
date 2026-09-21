---
title: Project Bridgewatch Phase 2 Design Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-2-design
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 2 - Wire the Signals

## Authority and entry record

- Base: `236c27241bb8d1630274f5d5412ec9addbdb8893` (`origin/main`).
- Branch: `codex/project-bridgewatch-phase2-wire-the-signals`.
- Worktree: `C:\Users\kkids\Documents\treasurehuntSoT-bridgewatch-phase2-wire-the-signals`.
- Phase 1 entry verification: the current mainline contains the standalone Fastify service, SQLite cache, GitHub GET collector, static dashboard, focused package tests, Phase 1 record, and `FT-034` at `MAINLINE`.
- Sounding Line authority: Parts I `1.2`, II `1.2`, and III `1.3`; the only protected authority context is `Sounding Line / Mainline Decision`.

`Project_Bridgewatch_Governing_Document_v1.1.pdf` was not present in the
repository, task attachments, or local governing-document search. The task
authority pasted with this phase is the applicable Version 1.1 requirement
source; this record does not alter or replace that PDF.

## Frozen architecture

Bridgewatch remains a standalone private Fastify service. It observes only:

- a durable source-indexed Project Registry in its own SQLite database;
- GitHub through existing server-side GET-only collection;
- the source-owned, schema-versioned Sounding Line runtime projection;
- narrow authenticated machine activity heartbeats.

It cannot change project state, milestones, Git state, GitHub state, Sounding
Line scheduling, worker leases, finalizer decisions, releases, or application
source. The only write routes are machine telemetry heartbeats and finish
events; they update Bridgewatch's local activity cache only.

## Durable and operational data

Migration 2 adds durable `project_history`, `phase_history`,
`milestone_history`, and `completion_records` tables. It also adds operational
`workers`, `test_runs`, and `test_nodes` tables. Durable history is never
pruned by the Phase 2 telemetry seam. A Phase 1 cache is retained and the
migration is repeat-safe.

Project records are source indexed, not inferred from commits, changed files,
or tests. In particular, an evidence record is not a milestone denominator:
progress is `UNMEASURED` until explicit governed milestone weights are known.
`COMPLETE` is asserted only where an accepted completion record explicitly
supports it; all insufficient records retain `UNKNOWN` and their missing
evidence explanation.

## Telemetry and privacy boundary

`scripts/sounding-line/status-projection.mjs` is the small Sounding
Line-owned, read-only status projection. It reads runtime markers, sealed
plans, receipts, and leases only. It does not write, schedule, acquire leases,
or emit a decision. Bridgewatch normalizes node state, queue versus execution
timestamps, retries, cleanup, and root/cascade semantics without changing the
underlying source.

Current and recent normalized Sounding Line plans/nodes are independently
stored in the local durable test-run tables; cached projection replacement does
not erase the retained run record.

The optional reporter accepts a strict activity-only schema at
`POST /api/telemetry/heartbeat` and `POST /api/telemetry/finish`. A dedicated
`BRIDGEWATCH_TELEMETRY_TOKEN` is accepted only as `Authorization: Bearer`; it
is never accepted in query or body fields, logged, stored, or reused from a
different authority. Unknown fields, prompt/log-shaped payloads, percentages,
completion claims, malformed timestamps, clock skew, and oversized bodies are
rejected. The reporter is rate limited and stale heartbeats become `STALE`,
never failed or complete project lifecycle. Loopback is the safe default.
Non-loopback hosting is rejected unless the operator explicitly enables it and
supplies distinct dashboard Basic-auth credentials; those credentials protect
human dashboard and observation endpoints only and are never used for telemetry.

## UI and non-goals

The dark private dashboard shows program totals, deduplicated attention,
ordinary Active/Completed/Planned/All project tabs, project biographies and
phase timelines, active workers, Sounding Line test totals, PRs, and each
source's freshness. It is keyboard operable, has visible focus, textual status,
reduced motion, and a 390px no-overflow layout.

Phase 3 trend analytics, controls, task editing, test retry/cancellation,
deployment controls, command execution, external notifications, multi-repo
federation, and human mutation controls remain out of scope.
