---
title: Project Drydock Phase 3 Runtime Fidelity Record
audience: engineering
status: current
canonical_for: project-drydock-phase-3-runtime-fidelity
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 runtime fidelity record

## Implemented shared boundary

`src/chronicle/runtime-semantics.ts` owns the pure completion decision used by both One Voyage progression and Drydock. `src/chronicle/progression.ts` persists the resulting canonical plan; `src/drydock/simulation/engine.ts` applies the same plan only to memory. The adapter version is `one-voyage-transition-v1`.

The shared boundary covers enabled-block selection, canonical target selection, variable mutation, artifact intent, completion/entry intents, automatic `condition` and `setVariable` traversal, chapter completion, tale completion, and no-target pause. It has no database, clock, network, random, provider, session, membership, or event-delivery dependency.

## Differential evidence

`src/drydock/simulation/differential.test.ts` projects a synthetic source for each of the 23 current Passage families. For each family it compares the simulator trace status, cursor, and event-intent sequence to `planCanonicalCompletion`. The proof is adapter-level: it proves the simulator invokes the exact planner used by production progression. It is not a live database-session replay, provider observation, or browser acceptance claim.

```powershell
npx vitest run src/drydock/simulation/differential.test.ts
```

## Explicit limitations

Scenario outcomes model provider and presentation dispositions; they do not call real providers or browser/device APIs. A virtual timer uses only the Scenario clock. Durable records preserve a frozen source snapshot and Scenario revision; an expired lease returns work to `QUEUED` for a fresh bounded replay, rather than claiming partial-input resume. Cancellation is checked before the bounded executor begins and at engine safe-step callbacks.

This record is development evidence only. Candidate qualification, protected-mainline acceptance, and live provider/device proof remain separate gates.
