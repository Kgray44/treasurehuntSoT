---
title: Project Bosun - Maintenance Cascade Suppression and Repair Convergence Amendment
audience: engineering
status: governing
canonical_for: project-bosun-v1.1-amendment
parent_program: Project Nightwatch
version: "1.1"
last_reviewed: 2026-08-21
amends: Development_Docs/Governing/Project_Bosun_Autonomous_Repository_Maintenance_and_Repair_Service_Governing_Document_v1.0.md
repository_baseline: 9201c4555fffbbb3946f8c946a7b374e0bb2d3c8
---

# PROJECT BOSUN v1.1 AMENDMENT

## Maintenance Cascade Suppression, Repair Convergence, and Fleet Unblocking

**Status:** Governing amendment to Project Bosun v1.0  
**Parent program:** Project Nightwatch  
**Date:** August 20, 2026

This amendment is additive. Unless explicitly changed here, Project Bosun v1.0 remains governing.

> **Governing Principle**  
> One shared defect must converge toward one verified repair outcome inside the parent Nightwatch transaction's absolute budget. Bosun must not transform a small defect into a growing family tree of repair PRs, generated-artifact follow-ups, admission bootstraps, stale successors, and duplicate rediscoveries. Maintenance exists to restore throughput, not to become the dominant workload. A locally bounded Bosun action does not authorize a globally unbounded integration.

---

## 1. Why This Amendment Exists

The repository demonstrated that bounded repair scope alone is insufficient. A repair can remain individually narrow and still participate in a destructive fleet-level cascade:

```text
shared defect
 -> narrow repair
 -> governed test changes
 -> deterministic registry drift
 -> registry repair
 -> protected selector/admission gap
 -> bootstrap repair
 -> main advances
 -> original repair identity stale
 -> rebuild/requalify
 -> dependent product candidate stale
 -> requalify product
```

Every step may be locally defensible while the total system becomes operationally absurd.

The August 20-21 evidence demonstrated the global loophole: individually narrow repairs, permitted browser runs, authority attempts, cooldowns, and retries composed into a 7h28 Nightwatch continuation and a 23h37 Wakebook continuation. Bosun must therefore account to the parent transaction, not celebrate each child as an independent bounded success.

Bosun v1.1 therefore governs **repair convergence**, not merely repair scope.

The unit of control is the semantic root finding and its entire descendant chain.

---

## 2. Root Finding and Cascade Identity

Every maintenance objective belongs to exactly one root cascade.

A `MaintenanceCascade` record must include at minimum:

```ts
type MaintenanceCascade = {
  cascadeId: string;
  rootFingerprint: string;
  parentIntegrationTransactionId: string;
  rootOwner: string;
  severity: string;
  blockedCandidates: string[];
  activeObjectiveId: string | null;
  generation: number;
  objectives: string[];
  pullRequests: number[];
  authorityRuns: string[];
  startedAt: string;
  cumulativeWallTimeMinutes: number;
  cumulativeControlPlaneMinutes: number;
  parentTransactionElapsedMinutes: number;
  cumulativeCandidateCount: number;
  cumulativeAuthorityAttempts: number;
  expectedClosureSteps: string[];
  status: "ACTIVE" | "CONVERGED" | "PARKED_OWNER" | "PARKED_BUDGET" | "PARKED_PARENT_BREAKER" | "BLOCKED_EXTERNAL";
};
```

Exact implementation language is not normative. Stable semantic identity and cumulative accounting are.

A child maintenance objective MUST inherit the root fingerprint and cumulative budget. Creating a new PR, branch, worktree, SHA, chat, or renamed error class does not create a fresh budget.

---

## 3. One Root Finding, One Active Repair Candidate

For one semantic root finding:

1. exactly one canonical active repair objective exists by default;
2. exactly one canonical active repair PR exists by default;
3. duplicate findings attach blocked projects/candidates to the existing cascade;
4. a second repair candidate is allowed only when the first is terminally superseded, structurally unusable, or an independently governed bootstrap stage is required;
5. when a successor becomes canonical, Bosun/Fairlead closes or clearly terminalizes the predecessor as soon as lineage is proven;
6. two product chats may not independently create competing repairs for the same shared fingerprint;
7. desired-tree identity or equivalent semantic output should be used to deduplicate mechanically equivalent repairs.

If Bosun discovers two active candidates that would produce the same intended correction, it chooses one canonical candidate and suppresses the duplicate.

---

## 4. Compound Repair Planning Before Mutation

Before creating a repair candidate, Bosun MUST determine the predictable governed consequences of the repair.

The planning check includes, when applicable:

- active test registry impact;
- documentation index impact;
- generated Feature Catalog impact;
- Deepwater/source-policy digest impact;
- ownership registration impact;
- maintenance-policy eligibility;
- protected-binding preflight eligibility;
- test registration/retirement impact;
- migration inventory impact;
- workflow dispatch/binding impact;
- required post-merge shared baseline proof.

Bosun records an expected closure plan such as:

```text
MW-00521 root: protected binding candidate-selection defect

expected closure:
1. bootstrap selector path into protected maintenance policy if required
2. land selector/binding repair
3. regenerate deterministic active registry if source/test registration changed
4. verify repaired binding against one exact maintenance candidate
5. wake blocked candidates
```

A predictable consequence discovered only after an expensive dependent product authority run is an orchestration miss and must be recorded as such.

---

## 5. Bundle Deterministic Consequences When Safe

If current protected governance safely permits a deterministic consequence to be included in the same maintenance candidate, Bosun SHOULD include it before candidate freeze.

Examples:

- generated active-test registry after adding/changing a governed test;
- generated document index after adding governing documentation;
- deterministic Feature Catalog projection after a declared catalog source change;
- deterministic policy/source digest after an eligible source update.

Rules:

1. generated outputs must come from canonical generators, never hand editing;
2. generator output must be deterministic/idempotent;
3. the generated path must already be eligible for the same authority class;
4. including generated closure must not allow a repair to self-authorize or weaken the verifier;
5. if the generated consequence cannot legally coexist with the root repair, it becomes a planned child stage inside the same cascade rather than a surprise new objective.

---

## 6. Bootstrap Stages Are One Compound Objective

Anti-self-authorization may legitimately require a policy/bootstrap PR before the intended repair can qualify.

Bosun MUST model this as one compound cascade:

```text
root finding
 -> bootstrap admission
 -> intended repair
 -> deterministic closure
 -> post-merge proof
```

The bootstrap does not count as a separate maintenance success for throughput metrics. It counts as maintenance amplification required by one root finding.

The bootstrap stage must declare:

- why existing protected policy cannot qualify the intended repair;
- exact additional path/class admitted;
- negative proof that unrelated paths remain rejected;
- exact intended dependent repair;
- rollback/terminal behavior if the dependent repair no longer applies.

A bootstrap that has no identified dependent repair is governance expansion and requires owner review.

---

## 7. Repair-of-Repair Circuit Breaker

A repair that exposes a defect in the machinery required to merge that repair is a **repair-of-repair**.

Bosun tracks cascade generation:

```text
generation 0 = root shared defect
generation 1 = direct prerequisite/consequence of root repair
generation 2 = repair required because generation 1 itself exposed control-plane failure
```

Defaults:

- generation 0: normal AUTO policy;
- generation 1: allowed within the same cumulative budget when tightly coupled;
- generation 2: warning + mandatory cascade review before new candidate creation;
- generation >2: park `PARKED_OWNER` unless an explicit bounded owner authorization identifies the remaining finite closure chain.

Generation counters never reset because main moved or a successor PR was created.

Bosun must not recursively repair the maintenance system without a visible bound.

---

## 8. Maintenance Amplification Budgets

In addition to v1.0 objective budgets, each cascade has cumulative limits.

Recommended defaults:

```json
{
  "maxActiveRepairCandidates": 1,
  "maxCascadeGenerationWithoutOwner": 2,
  "maxRepairPullRequestsPerRoot": 3,
  "maxProtectedMaintenanceAttemptsPerRoot": 4,
  "maxMainlineRebuildsPerRoot": 2,
  "warningWallClockMinutes": 45,
  "parkWallClockMinutes": 90
}
```

These are cumulative across all child objectives.

### 8.1 Parent Nightwatch Budget Is Absolute

Every Bosun cascade causally required by a queue-front candidate inherits that Nightwatch Integration Transaction ID and its Total Integration Cost Budget.

The parent budget includes Bosun diagnosis, worktree setup, repair implementation, generated closure, focused proof, authority, protected maintenance binding, cooldowns, API waits, mainline rebuilds, post-merge proof, and dependent wakeup. A child objective may have a smaller local budget; it may never have a larger effective allowance than the remaining parent budget.

The following do not reset or suspend parent accounting:

- a new repair PR or successor;
- a new maintenance generation;
- a renamed fingerprint that remains causally equivalent;
- a new chat, worktree, machine, agent, or controller process;
- a cooldown, rate-limit wait, or external GitHub queue;
- a locally successful child merge that does not restore the parent product integration path.

When Nightwatch reaches `INTEGRATION_HARD_REVIEW`, Bosun may finish an already-running safe unit but MUST NOT create another descendant candidate or dispatch another expensive acceptance path until the parent review authorizes a finite step.

When Nightwatch reaches `INTEGRATION_CASCADE_BREAKER`, Bosun enters `PARKED_PARENT_BREAKER`, cancels cancellable work at safe boundaries, preserves the cascade ledger and last verified state, releases leases, and creates no new descendant work until an explicit bounded parent recovery plan exists.

Bosun success metrics must distinguish child activity from parent progress. A repair merge that leaves the same queue-front blocker unresolved is maintenance activity, not restored throughput.

### 8.2 Durable and Cancellable Maintenance Work

Any Bosun operation capable of materially consuming the parent budget must be:

- idempotent;
- cancellable between declared safe units;
- lease-aware;
- resumable after controller or worktree restart;
- tied to exact source/candidate identity;
- bounded by explicit time, state, attempt, and output limits;
- capable of returning truthful partial evidence.

This adopts Project Drydock's long-work contract. Bosun also follows Project Landfall's failure behavior: bounded backoff for temporary conditions, truthful degraded/rate-limited/blocked status, preservation of last safe context, rejection of stale evidence, and reconciliation rather than replayed success.

Exceeding a threshold does not authorize unsafe bypass. It causes one of:

- converge using an already-defined remaining closure plan;
- park and escalate;
- redesign the control-plane contract as a separate owner-approved project rather than continuing ad hoc descendants.

---

## 9. Generated-Artifact Drift Is Normally `AUTO_0`

Deterministic generated drift remains an `AUTO_0` class when its source/input identity is already trusted and no authority semantics are changing.

Bosun should:

```text
identify canonical generator
 -> run generator
 -> prove deterministic second run
 -> verify only expected generated paths changed
 -> attach to root cascade if causally related
 -> use current governed maintenance route
```

If an active canonical registry/index repair PR already exists for the same desired output tree, Bosun MUST reuse or reconcile it rather than create another equivalent repair PR.

A generated-artifact repair created because a previous maintenance merge changed its input is a child of that previous root cascade.

---

## 10. Current-Main Rebuilds Must Reuse the Same PR Where Possible

When protected main advances during maintenance qualification:

1. determine whether the semantic repair is still required;
2. if yes, reconcile/rebuild the same canonical active PR onto current main when safe;
3. preserve the same root cascade and objective identity;
4. refresh only invalidated focused evidence;
5. freeze one new exact candidate identity;
6. do not create a successor PR merely because the base SHA changed.

A new PR is justified only when the existing branch/PR cannot safely represent the new candidate or lineage policy explicitly requires replacement.

Main movement increments `mainlineRebuilds` and never resets the cascade budget.

---

## 11. Protected Maintenance Integration Slot

Before final authority and protected merge, Bosun requests Nightwatch's `INTEGRATION_ACCEPTANCE` lease for the maintenance candidate when that maintenance is the queue-front prerequisite.

The goal is not to monopolize main. The goal is to avoid this failure mode:

```text
maintenance candidate qualifies
 -> unrelated managed merge advances main
 -> exact acceptance stale
 -> maintenance candidate rebuilds
 -> qualifies again
 -> another managed merge advances main
```

Rules:

- only one protected maintenance acceptance slot exists by default;
- P0 security/integrity work may preempt according to Nightwatch policy;
- local diagnosis and focused verification may continue without the slot;
- the slot should begin only near candidate freeze/authority and end immediately after merge or terminal result;
- `RELEASE_GO`/maintenance acceptance to binding and binding to merge must be dispatched promptly.

---

## 12. Dependent Wakeup Is Coalesced

After a repair converges, Bosun wakes all blocked candidates attached to the root finding once.

It does not ask every blocked project chat to independently rediscover whether the repair worked.

Wakeup receipt includes:

- root finding/cascade ID;
- landed protected-main SHA/tree;
- postcondition evidence;
- affected candidate IDs/PRs;
- exact prerequisite now satisfied;
- whether candidate reconciliation is required;
- whether focused evidence can be preserved;
- canonical next state (`QUEUE_READY`, `QUEUE_FRONT`, `REQUALIFYING`, etc.).

Multiple product projects blocked by one shared defect should receive one shared repair event, not one repair campaign per project.

---

## 13. Deepwater, Ownership, and Policy Drift Preflight

Recurring deterministic prerequisite classes should be checked before expensive authoritative product qualification when current governance declares them prerequisites.

Examples include:

- stale Deepwater policy identity;
- missing trusted ownership mapping;
- missing active-registry generated entry;
- known maintenance path omitted from current protected admission;
- known current-main binding selector mismatch.

Bosun may create/attach findings from the preflight, but it must not weaken the product authority boundary.

The purpose is to stop using a full product authority run as a discovery mechanism for a deterministic shared control-plane defect already detectable from current protected main.

---

## 14. Authority Runs Are Not Debuggers

Bosun v1.0 already prohibits repeated full authority as a debugging strategy. v1.1 strengthens the rule:

- reproduce/diagnose the root condition before a protected authority attempt when reasonably possible;
- one exact candidate/base has one active authority attempt;
- identical authority failure fingerprints do not justify immediate redispatch;
- a second equivalent full authority failure parks unless new focused evidence proves a materially changed condition;
- failed authority due to pending prerequisite, stale base, or duplicate workflow state is classified as orchestration/shared state, not as a new repair fingerprint;
- authority attempts count cumulatively across cascade descendants.

---

## 15. Repair Success Means Fleet Throughput Restored

A maintenance source diff is only an intermediate product.

A cascade reaches `CONVERGED` only when:

1. exact intended repair is on protected main;
2. deterministic consequences are coherent;
3. post-merge shared postconditions pass;
4. duplicate/superseded repair candidates are terminalized;
5. blocked candidates are woken/coalesced;
6. the root failure no longer blocks the intended integration path;
7. no planned child stage remains open.

If the repair merged but the product fleet remains blocked by a predictable descendant from the same root cause, the cascade remains active.

---

## 16. New Bosun State Model

The v1.0 objective state machine remains, with cascade-aware additions:

```text
DETECTED
 -> NORMALIZED
 -> DEDUPLICATED
 -> CLASSIFIED
 -> CASCADE_ATTACHED
 -> CLOSURE_PLANNED
 -> QUEUED
 -> LEASED
 -> DIAGNOSING
 -> REPAIRING
 -> FOCUSED_VERIFICATION
 -> CANDIDATE_READY
 -> ACCEPTANCE_PENDING
 -> INTEGRATING
 -> POST_MERGE_VERIFY
 -> DEPENDENT_WAKEUP
 -> CASCADE_CONVERGENCE_CHECK
 -> RESOLVED
```

Additional controlled exits:

```text
PARKED_CASCADE
PARKED_OWNER
PARKED_BUDGET
PARKED_PARENT_BREAKER
BLOCKED_EXTERNAL
DUPLICATE_SUPPRESSED
SUPERSEDED
CANCELLED_INTEGRITY
```

A child objective finishing does not automatically resolve the root cascade.

---

## 17. Bridgewatch Bosun Station Additions

Bridgewatch must show cascade-level truth.

For every active cascade display:

```text
root fingerprint
canonical owner
root severity
cascade generation
active repair objective/PR
parent/child closure stages
blocked projects/candidates
PRs created / merged / superseded
mainline rebuild count
authority attempt count
cumulative wall time
parent transaction elapsed time
product-value vs control-plane time
parent budget/breaker state
maintenance amplification metrics
predicted remaining closure steps
```

Aggregate metrics add:

- maintenance PRs per integrated product PR;
- repair PRs per root finding;
- repair-of-repair frequency;
- percentage of deterministic consequences bundled before freeze;
- duplicate repair candidates suppressed;
- average dependent candidates unblocked per shared repair;
- percentage of cascades converging at generation 0/1;
- cascades requiring owner intervention;
- time from shared repair merge to dependent wakeup;
- control-plane active and wait minutes contributed to each parent integration transaction;
- percentage of cascades stopped by the parent breaker before another descendant PR;
- child merges that failed to reduce the parent transaction's remaining closure steps.

A dashboard that shows many maintenance merges without showing whether product candidates were unblocked is incomplete.

---

## 18. Acceptance Tests Added by v1.1

Bosun is not operationally mature until automated tests prove at least:

1. duplicate equivalent findings from two product candidates produce one cascade and one active repair objective;
2. a generated-registry consequence caused by a maintenance source/test change is predicted before dependent product authority when deterministically knowable;
3. an eligible deterministic generated consequence is bundled in the same repair candidate;
4. an anti-self-authorization bootstrap remains one compound cascade and shares cumulative budgets with its dependent repair;
5. cascade generation survives successor PRs, new SHAs, mainline rebuilds, and controller restarts;
6. generation >2 parks without explicit bounded owner authorization;
7. current-main movement rebuilds/reconciles the same canonical repair PR when safe;
8. an existing equivalent active repair PR suppresses creation of a duplicate;
9. authority attempts for equivalent unchanged candidates are deduplicated;
10. maintenance acceptance obtains the Nightwatch integration slot before final protected merge;
11. one landed repair wakes every blocked candidate attached to the root finding;
12. root cascade remains active if a planned deterministic child closure is incomplete;
13. Bridgewatch accurately reports cascade generation, cumulative PRs, attempts, and blocked candidates;
14. a replay of the August 20 cascade pattern trips the configured breaker before an unbounded repair family develops;
15. Bosun time, waits, PRs, authority, and rebuilds accumulate in the parent Nightwatch Total Integration Cost Ledger;
16. a new PR, SHA, chat, worktree, generation, or controller restart cannot reset parent or cascade cost;
17. a child operation inside its own local allowance is stopped when the parent breaker trips;
18. `PARKED_PARENT_BREAKER` preserves the candidate, cascade ledger, partial evidence, and last verified state while preventing new descendants;
19. cancellation and restart resume idempotently without replaying maintenance acceptance, binding, merge, or dependent wakeup;
20. the 7h28 Nightwatch and 23h37 Wakebook replays stop before their historical unbounded continuation points;
21. Bridgewatch distinguishes child maintenance activity from parent product-integration progress.

---

## 19. Immediate Operational Rule

Until full Bosun automation exists, every maintenance Codex continuation must apply this manual-equivalent discipline.

Before step 1, attach the objective to its parent Nightwatch Integration Transaction and read the remaining parent budget. A new continuation may not manufacture fresh time by forgetting the parent ledger.

```text
1. identify semantic root fingerprint
2. search for existing canonical repair/cascade
3. attach instead of duplicate when one exists
4. predict deterministic/policy/ownership consequences
5. define finite closure plan
6. create/update one active repair candidate
7. run focused proof
8. obtain exact governed maintenance authority
9. integrate promptly under Nightwatch acceptance slot
10. perform deterministic post-merge closure
11. wake all blocked candidates once
12. close/supersede duplicate historical repair PRs
```

If a repair creates a repair creates a repair, stop counting local successes and evaluate the cascade.

If the parent Nightwatch breaker has tripped, park Bosun work durably. Do not create one more "bounded" child.

---

## 20. Governance

This amendment does not grant Bosun release authority or permission to weaken Sounding Line, branch protection, security, ownership, or evidence requirements.

Bosun remains subordinate to Nightwatch. Sounding Line remains final verification/acceptance authority. Fairlead remains GitHub interaction authority. Product owners retain product semantics.

The amendment changes the maintenance control objective from:

> "produce a valid narrow repair"

into:

> **"converge one shared root defect to a verified protected-main state that restores fleet throughput, with bounded total amplification, inside the parent integration transaction's absolute cost budget."**

That is the required definition of successful repository maintenance.

---

**End of Project Bosun v1.1 Amendment**
