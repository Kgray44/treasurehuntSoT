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

The original candidate `1c888c92d7aa54abf9d16d86e916751bab4b7fc1` received its one serialized Mainline Decision and terminated `RELEASE_NO_GO` because four unrelated registered evidence suites were invalid. The [failure record](Project_Drydock_Phase_3_Mainline_Decision_Failure_Record.md) preserves the exact disposition. That candidate cannot be retried.

Replacement candidate r2 (`bc8f404b81659348bb229ac662b34961186a4068`, tagged `project-drydock-phase3-candidate-20260812-r2`) was superseded, not rejected, when Bridgewatch's accepted closure advanced current main. The [reconciliation record](Project_Drydock_Phase_3_Reconciliation_Record.md) captures the exact input and merge commit.

The r3 candidate (`01a925d13fb5ab0a6064c1e6e4d2f1995a032349`, tagged
`project-drydock-phase3-candidate-20260812-r3`) received its one explicit hosted
Mainline Decision, run `31601859085`, and ended `EVIDENCE_INVALID` because the
required `browser.helm` worker failed with clean teardown. Its [failure
record](Project_Drydock_Phase_3_Mainline_Decision_Failure_Record.md) preserves
the source-bound receipt and classification. The smallest focused hosted
`browser.helm` diagnostic, run `31604050573`, independently failed with clean
teardown: all heartbeat mutations returned HTTP 200 but the Captain presence
projection did not converge within its governed deadline. Development is now
with the Helm-owned focused repair; r3 may not be retried. Only a repaired,
requalified, newly frozen candidate may receive one future authority decision
after canonical acceptance ownership is reacquired.

## Replacement-candidate recovery

The Helm-owned remediation was published at
`bf03b0811eada44f6f9db56858b76e7c778e1d81` and incorporated into this Drydock
branch as `5717ab5c2f1445cd899471932b99eacf20e81bc1`. On that combined source,
the directly affected unit scope passed 15/15 and focused hosted run
`31608295048` passed the sealed three-case `browser.helm` selection with exit
code `0` and clean teardown. This is development evidence only; it has no
finalizer and does not substitute for a Mainline Decision.

`origin/main` still resolves to the r3-qualified base
`5735d43821209adb2259ec2c38979281da1bb5b9`, so no new current-main advance
needs reconciliation. The next step is the required full replacement-candidate
qualification, followed by a new exact freeze and one new explicit authority
decision after acceptance ownership is acquired.

## r4 replacement candidate

Replacement qualification completed after the Helm recovery: `npm run
drydock:test` passed 33 files / 196 tests; the Studio Scenario Lab plus
scenario/simulation API scope passed 6 files / 14 tests; both Drydock migration
rehearsals passed with 59 applied migrations and static MySQL parity; the
focused Helm unit scope passed 15/15; hosted focused run `31608295048` passed
the three-case browser selection cleanly. Policy, Prisma, generated client,
typecheck, static, Sounding Line runtime, production build, documentation, and
Feature Catalog checks also passed.

Candidate r4 (`fd57f0f23330d86502808b197c2b9d5f3a90e422`, tagged
`project-drydock-phase3-candidate-20260812-r4`) consumed its one hosted
Mainline Decision in run `31612564391`. The finalizer returned
`EVIDENCE_INVALID` solely because `unit.feature-catalog` expected 45 audited
entries while the branch-complete Phase 3 fragment makes the correct count 46;
the other 17 receipts passed with clean teardown. The candidate is terminal and
must not be retried. The next lifecycle step is the smallest Feature Catalog
test after the count repair, followed by the complete replacement-candidate
qualification and a new freeze before any new authority request.

## r5 replacement candidate

The count repair is committed at `6a5d66e23e1793afb60bcafc16f723661798d68e`.
Its focused Feature Catalog suite passed 9/9, including the stable 46-entry
count and the `FT-036` Project Drydock Phase 3 assertion. The complete Drydock,
Studio/API, migration, policy, Prisma, static, Sounding Line runtime,
production-build, documentation, and 46-entry Feature Catalog qualification
then passed. Fetched `origin/main` remained
`5735d43821209adb2259ec2c38979281da1bb5b9` with no advance or conflict.

Candidate r5 was frozen but did not receive authority. Helm's accepted protected
merge advanced main to `920d92a51a16d60a2dfe35278598e6d921be7e4c`, so r5 is
superseded and must not be used for a decision.

## r6 replacement candidate

The r6 rebase preserved both accepted Helm presence contracts and Drydock
contracts in the shared Sounding Line registry. Feature Catalog passed 9/9 at
46 entries; policy passed at 57 suites / 455 contracts; Sounding Line runtime
passed 21/21; Drydock passed 33 files / 196 tests; both migrations passed at 59
with static MySQL parity; generated Prisma client, typecheck, static, production
build, documentation, and Catalog validation passed.

The next commit is frozen under tag
`project-drydock-phase3-candidate-20260812-r6`. It is the sole current
replacement candidate eligible for one explicit Mainline Decision after
canonical acceptance ownership is acquired. r3 and r4 remain terminal history;
r5 is superseded and none may be retried.

## Protected acceptance result

The frozen r6 candidate `fcd9010a37224759bb5b71c640e121c9e4f1e1e2` received
one hosted Mainline Decision: run `31618253086` finalized `RELEASE_GO` with
38 / 38 required receipts passed and 38 / 38 cleanup states `CLEAN`. Protected
binding run `31620037280` passed before PR #52 merged at
`191a964488d0df71f8dcb91c5b8372fc73b6b32e`; the exact-main proof is recorded
in the [reconciliation record](Project_Drydock_Phase_3_Reconciliation_Record.md)
and [completion receipt](Project_Drydock_Phase_3_Completion_Receipt.md).

No additional Mainline Decision is permitted for this accepted phase. The
remaining closure documentation is record-only and currently remains
unmergeable under `TARGET_ARCHITECTURE_PENDING`.
