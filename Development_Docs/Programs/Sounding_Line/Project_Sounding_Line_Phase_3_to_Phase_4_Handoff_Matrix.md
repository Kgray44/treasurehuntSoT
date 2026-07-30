---
title: Project Sounding Line Phase 3 to Phase 4 Handoff Matrix
audience: engineering
status: planned
---

# Phase 3 to Phase 4 Handoff Matrix

| Contract    | Phase 3 behavior                                                              | Phase 4 envelope/control                                             |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| plan        | deterministic policy/source/plan digests, selection and omission explanations | sealed plan, source checkout, policy snapshot, node grant            |
| evidence    | cleanup-bound freshness, reuse, prohibited reuse, invalidation                | upload, artifact digest chain, cleanup receipt, revocation reference |
| history     | schema-2 runs/nodes/attempts/results/failures/artifacts/environments          | worker/node/attempt attribution and integrity-bound manifests        |
| diagnosis   | outcomes, root/cascade, signatures, rerun plan                                | normalized worker report and controller adjudication                 |
| capacity    | duration classes, shard plans, resource profiles, throttle states             | capability advertisement and resource-lease dispatch                 |
| durable run | journal, duplicate suppression, cancel/resume/recover, orphan quarantine      | heartbeat, draining, cancellation, recovery ownership                |
| governance  | completion-report validation and Usage Footer                                 | vetoed release decision and usage accounting                         |

Dual-run compares source/policy, selection/omission, reuse/invalidation,
results/retries, root/cascade, environment, database/browser identity, coverage,
duration, resources, artifacts, cleanup, and final decision. Concurrent order,
run-owned ports/paths, normalized diagnosis, retained retries, certified setup
reuse, and duration-aware shards may differ. Missing mandatory proof, weaker
coverage, unexplained omission, lost product failure, privacy/authorization
weakening, cleanup failure, incompatible decision, falsely green P34, or falsely
validated providers are unacceptable differences.

This is a non-executable handoff: it authorizes no worker, credential, CI
configuration, network endpoint, release decision, or cutover.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
