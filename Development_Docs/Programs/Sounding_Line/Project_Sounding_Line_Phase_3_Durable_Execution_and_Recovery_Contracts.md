---
title: Project Sounding Line Phase 3 Durable Execution and Recovery Contracts
audience: engineering
status: current
---

# Durable execution and recovery contracts

Future client-independent commands are `status`, `follow`, `cancel`, `resume`, `inspect`, and `recover`. A journal binds controller/client/worker identity, run/node/lease/evidence records, resume token, plan/source/policy identities, duplicate-launch prevention, and cleanup state. Resume is permitted only with matching source/policy/plan, recoverable resource ownership, verified evidence, safe incomplete nodes, and known cleanup; otherwise teardown is required, evidence is preserved, and a new plan is required. State-machine fixtures cover disconnect, controller/machine crash, resumable work, changed source, stale client, and ambiguous ownership. No active resume is added.
