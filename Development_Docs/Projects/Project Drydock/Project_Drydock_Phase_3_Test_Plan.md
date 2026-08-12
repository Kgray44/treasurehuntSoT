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

## Focused browser qualification

The focused task-owned browser qualification is recorded in [the browser qualification record](Project_Drydock_Phase_3_Browser_Qualification_Record.md). It exercised an authenticated Creator's normal Scenario save/run, deterministic replay, semantic receipt comparison, coverage/suggestion projection, Scenario Suite save, and Scenario Suite run against an isolated production build and task-owned SQLite database. The initial run exposed two schema/persistence defects; both were repaired and covered by a schema regression test and an expanded migration-rehearsal shape check before the successful rerun.

This is local, synthetic, task-owned evidence only. It is not a staging, deployment, live-provider, physical-device, owner-acceptance, or protected-mainline claim.

## Candidate freeze and acceptance boundary

Focused Drydock/Studio/API qualification, static checks, build, documentation, catalog, migration rehearsal, and the local browser record completed before the one current-main reconciliation. The reconciled candidate's schema/client, deterministic suite, policy registry, and migration proof were rerun; the [reconciliation record](Project_Drydock_Phase_3_Reconciliation_Record.md) captures that exact mainline input and conflict resolution.

The candidate is frozen pending canonical acceptance. Sounding Line remains prohibited for any new commit. Only the one serialized Mainline Decision against the frozen branch head may determine `RELEASE_GO`; protected integration and exact-main proof remain required after that decision.
