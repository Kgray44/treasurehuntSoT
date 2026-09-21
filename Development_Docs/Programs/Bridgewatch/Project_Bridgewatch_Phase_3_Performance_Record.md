---
title: Project Bridgewatch Phase 3 Performance Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-performance
last_reviewed: 2026-08-13
---

# Project Bridgewatch Phase 3 Performance Record

## Measurement contract

The governed targets are a preferred steady RSS at or below 150 MB (review at
256 MB), approximately 1% idle CPU, a warm private-network response below one
second, visual readiness below two seconds, and retained SQLite below 250 MB.
Measurements use a task-owned local process and synthetic history fixture;
they do not claim a production deployment result.

## Representative fixture

The Phase 3 performance suite seeds 36 projects, 108 phases, 324 milestones,
50 workers, 240 recent test nodes, 120 daily normalized snapshots, meaningful
event transitions, and retention work across a 120-day source timeline. It
also exercises authenticated telemetry at 10, 25, and 50 workers and a warm
summary response for each count. The fixture contains no private repository,
user, prompt, command, log, cookie, credential, or application payload.

## Accepted implementation measurement

On 2026-08-12, the task-owned production build ran loopback-only on a separate
port with an isolated private test database and no credential. After startup,
ten warm `GET /api/summary` requests returned `200`: mean 25.51 ms and maximum
82.83 ms. The Node process RSS was 79.02 MB. A five-second idle sample on the
16-logical-processor host produced 0.000% normalized CPU. The task-owned
browser's post-load dashboard showed the current history/control-room surface
without a client error; desktop, phone, and wide layout observations are in the
Validation Record.

The representative historical fixture recorded the following from its exact
test output:

| Metric                                               |                                      Result |
| ---------------------------------------------------- | ------------------------------------------: |
| Projects / phases / milestones                       |                              36 / 108 / 324 |
| Workers / recent test nodes                          |                                    50 / 240 |
| Last-12-hour events / project-history events queried |                     73 / 100 (bounded page) |
| History query                                        |                                     1.85 ms |
| Retention                                            |                                 1,415.41 ms |
| SQLite file                                          |                30,887,936 bytes (29.45 MiB) |
| Warm summary fixtures                                | 10, 25, and 50 workers all below one second |

Every assertion remains deliberately stricter than the product budget: warm
summary/history queries must stay below one second, retention below five
seconds for the fixture, and the database below 250 MB. This is local,
task-owned evidence; it is not a deployment acceptance claim.

## Operational interpretation

Historical work is incremental: current-source collection compares normalized
state, snapshot digests skip repeats, events use keyed IDs, query paths use
timestamp/project/phase/kind indexes, and retention materializes rollups before
deleting only allowlisted transient rows. If a future measured result exceeds a
budget, reduce snapshot/event duplication, retained payload size, indexes, or
polling work before considering a documented exception.
