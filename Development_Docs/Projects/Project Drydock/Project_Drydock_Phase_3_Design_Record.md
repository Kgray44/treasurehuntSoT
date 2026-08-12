---
title: Project Drydock Phase 3 Run Sea Trials Design Record
audience: engineering
status: current
canonical_for: project-drydock-phase-3-design
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3: Run Sea Trials design record

## Authority and base

Phase 3 is active from fetched `origin/main` base `236c27241bb8d1630274f5d5412ec9addbdb8893` on `codex/project-drydock-phase3-run-sea-trials`. Phase 1 and Phase 2 are accepted foundations: the 23-versioned-block contract registry, canonical `BlockConnection` graph, typed variables and expressions, static rules, report receipts, repairs, and waivers remain authoritative and unchanged.

Phase 3 adds executable, deterministic proof for an exact Chronicle source and versioned Scenario. It does not start Phase 4, alter publication authority, or mutate a real Tale Session, TaleSessionEvent, membership, invitation, draft, published version, artifact ownership, Community record, or protected asset.

## One runtime truth

`src/chronicle/progression.ts` currently owns the executable transition decisions for block completion, automatic `condition`/`setVariable` traversal, variable changes, inventory grants, terminal state, canonical next-block selection, and event intents. Phase 3 will extract the decision-only portion into a pure `src/chronicle` runtime-semantics module. Production progression will invoke that module before it persists its canonical events. Drydock will invoke the identical module against only an in-memory simulation state.

The pure adapter receives the immutable published or canonicalized draft snapshot, explicit current state, explicit input/outcome, fixed time, and an injected deterministic seed. It returns a bounded transition plan: next state, ordered event intents, required provider request, presentation requirement, and terminal/error disposition. It receives no Prisma client, current time, ambient random source, network, or process-global mutable state. Database writes, memberships, real artifact grants, reveal-state rows, delivery, and audit emission remain One Voyage effects layered outside the pure plan.

The adapter version is `one-voyage-transition-v1` until a versioned semantic change is accepted. Every simulation run records that version and the exact source checksum. A differential suite proves the plan used by the simulator equals the plan used by the canonical One Voyage adapter for every current block family and cross-block automatic path.

## Deterministic simulation model

A `DrydockScenario` revision is strict JSON with `schemaVersion`, immutable source checksum, safe title/purpose, initial state, environment, fixed seed, ordered inputs, typed fault schedule, assertions, and explicit resource limits. It cannot contain executable code, wall-clock values, secrets, raw accepted answers, private prose, or unrestricted provider evidence.

The simulation state carries only synthetic data: source identity, current block, variables, inventory, reveal identifiers, pending provider request, status, virtual time, seeded random state, ordered event intents, and bounded trace/coverage. A deterministic virtual clock begins at an explicit ISO instant and advances only through Scenario inputs or governed auto-advance. Repeat runs with the same source, scenario revision, adapter version, and limits must produce the same trace digest, semantic result, coverage, and assertion dispositions.

Single-path, suite, replay, and differential profiles share one bounded executor. Exploration limits currently enforce step, state, trace, and virtual-duration bounds; reaching a limit yields `INCOMPLETE_PROOF`, never a silent pass. Cancellation is observed at engine safe-step callbacks. Durable runs use frozen source snapshots, source-checksum revalidation, and leases. An expired lease returns a run to `QUEUED` for a fresh bounded replay; partial-input resume is not claimed by this phase implementation.

## Faults, privacy, and projections

Network, asset, provider, runtime, presentation, device, accessibility, and time faults are typed scenario data. A fault affects only its synthetic run and is recorded in a redacted trace. Trace and report projections contain safe IDs, rule codes, state names, counts, outcome tokens, and redacted deltas. They exclude accepted answers, secret clue prose, Captain/Creator notes, invitation secrets, storage keys, raw provider evidence, exact private locations, and unrevealed finale content.

Scenario, run, trace, comparison, and coverage APIs require Creator ownership or a scoped collaborator capability at the service boundary, enforce CSRF for mutations, reject client-controlled source checksum/status/owner fields, and fail closed if the source changes. Browser and integration work uses a task-owned SQLite database, storage root, port, and browser state.

## Studio and delivery boundary

The Studio Scenario Lab is a first-class, reachable Chronicle-editor surface. It offers safe Scenario create/edit/reorder/validate/run/cancel/replay/compare flows, expected-outcome editing, generated-but-unsaved coverage suggestions, and ordinary error/loading/empty states. Trace Inspector, State Diff, and Coverage views have text/table equivalents, visible focus, keyboard operation, reduced-motion-safe status, narrow/mobile layouts, and redacted projections. The data contract is Drydock-owned; Shipwright remains the interaction and layout authority.

Phase 3 will add additive SQLite/MySQL persistence for Scenario identity/revisions/suites and Simulation run summaries/checkpoints. Existing validation receipts and waivers are not rewritten. Live MySQL absence is an external-provider classification only after schema parity and all locally attainable migration proof pass.

## Required qualification and stopping rule

Development uses focused non-authoritative tests after every coherent change. Once implementation is complete, the candidate qualification includes the Phase 3 suite, One Voyage differential evidence, Studio/component/browser evidence, security/privacy/accessibility/performance/migration/schema/documentation/catalog/build checks, and affected cross-project evidence. Only then may one frozen exact candidate enter `Sounding Line / Mainline Decision` under canonical acceptance ownership. Phase 4 remains unstarted after Phase 3 acceptance.
