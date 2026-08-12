---
title: Project Drydock Phase 3 Test Plan
audience: engineering
status: current
canonical_for: project-drydock-phase-3-test-plan
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 test plan

## Focused lifecycle

After each coherent change, run the nearest focused test and repair that scope before continuing. The Simulation unit group covers strict Scenario parsing, virtual time, seeded random, fault catalog, deterministic execution, source identity, coverage, suite schema, and One Voyage adapter differential. The store and route group covers revision conflicts, frozen source persistence, leases, Creator ownership, and CSRF-backed mutations. The Studio component group covers save-before-run, private request headers, and receipt rendering.

## Current locally attainable commands

```powershell
npx vitest run src/drydock/simulation src/drydock/scenario-store.test.ts src/drydock/simulation-store.test.ts
npx vitest run src/components/studio/DrydockScenarioLab.test.tsx
npx vitest run "src/app/api/studio/tales/[taleId]/scenarios/route.test.ts" "src/app/api/studio/tales/[taleId]/scenarios/[scenarioId]/runs/route.test.ts" "src/app/api/studio/tales/[taleId]/scenarios/suites/route.test.ts"
npm run drydock:phase3:migrations:sqlite
npm run test:policy
npm run typecheck
```

The migration rehearsal uses a disposable task-owned SQLite file and checks additive migration ordering, schema creation, foreign-key integrity, and static MySQL fragment parity. It does not claim a live MySQL migration. The Sounding Line policy command validates registration only; it is not a Mainline Decision and cannot certify this phase.

## Candidate qualification pending

Before a candidate can request the serialized Mainline Decision, run the complete affected Drydock/Chronicle/Studio suite, lint, build, docs and feature catalog validation, browser checks in an isolated runtime, performance measurements, migration proof, current-main reconciliation, and the Phase 3 requirement ledger. Sounding Line remains prohibited until those qualification records are complete and a frozen candidate owns canonical acceptance.
