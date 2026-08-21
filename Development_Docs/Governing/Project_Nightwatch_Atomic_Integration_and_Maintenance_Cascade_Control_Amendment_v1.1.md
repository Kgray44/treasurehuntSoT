---
title: Project Nightwatch - Atomic Integration and Maintenance Cascade Control Amendment
audience: engineering
status: governing
canonical_for: project-nightwatch-v1.1-amendment
version: "1.1"
last_reviewed: 2026-08-21
amends: Development_Docs/Governing/Project_Nightwatch_Unattended_Autonomy_and_Overnight_Operations_Governing_Document_v1.0.md
repository_baseline: 9201c4555fffbbb3946f8c946a7b374e0bb2d3c8
---

# PROJECT NIGHTWATCH v1.1 AMENDMENT

## Atomic Integration, Global Cost Containment, Authority Sequencing, and Maintenance Cascade Control

**Status:** Governing amendment to Project Nightwatch v1.0  
**Date:** August 20, 2026

This amendment is additive. Unless this document explicitly changes a Nightwatch v1.0 rule, the v1.0 governing baseline remains in force.

> **Governing Principle**  
> A queue-front candidate is one atomic, globally bounded integration transaction. Reconciliation, qualification, authority, protected binding, merge, and exact-main proof must be sequenced by Nightwatch as one controlled operation. Missing authority that has not yet been requested is a pending state, not a release failure. Shared maintenance must converge instead of recursively generating more maintenance. Locally bounded actions MUST NOT compose into a globally unbounded transaction.

---

## 1. Why This Amendment Exists

The August 20 integration campaign exposed a control-plane gap not stated strongly enough in Nightwatch v1.0. The repository repeatedly produced this sequence:

```text
candidate reconciled to current main
 -> candidate SHA changes
 -> pull-request event immediately starts protected binding
 -> protected binding searches for exact sealed authority
 -> exact authority does not exist yet because qualification has not run
 -> Mainline Decision reports failure
 -> qualification is dispatched afterward
 -> main advances during qualification
 -> candidate is reconciled again
 -> the cycle repeats
```

The individual fail-closed checks were often correct. The orchestration was not.

The same campaign also demonstrated **maintenance amplification**: a shared repair could change governed tests, require generated-registry reconciliation, expose a selector or ownership admission gap, require a bootstrap maintenance candidate, advance protected main, invalidate already-qualified identities, and cause dependent product candidates to refreeze again. Several individually legitimate repairs therefore combined into a recursive maintenance cascade that consumed substantially more integration capacity than the product work being admitted.

The August 20-21 continuation evidence proved that this was not a theoretical risk. One Nightwatch continuation ran for **7 hours 28 minutes** without landing Increment A. One Wakebook continuation ran for **23 hours 37 minutes** without simply reaching its already-defined product finish line. Together, those two continuations consumed **31 hours 5 minutes** of elapsed Codex activity while repeatedly traversing maintenance prerequisites, generated-state repair, authority, browser matrices, cooldowns, reconciliation, and control-plane recovery.

The decisive defect is broader than maintenance PR count:

> **Voyagewright allowed locally bounded verification, waiting, repair, and retry actions to compose into globally unbounded integration transactions.**

A browser worker may be inside its own allowance. A repair may be narrow. A cooldown may be policy-compliant. A requalification may be individually justified. None of those local facts authorizes the parent product integration to continue for seven or twenty-three hours without a global convergence decision.

Nightwatch was created to prevent exactly this class of fleet-level coordination failure. The requirements below are therefore normative, not optional optimization guidance.

---

## 2. Atomic Integration Transaction

Only the queue-front candidate may hold an active **Integration Acceptance Transaction**.

The normative state machine is:

```text
QUEUE_FRONT
 -> RECONCILING
 -> REQUALIFYING
 -> CANDIDATE_FROZEN
 -> AWAITING_AUTHORITY
 -> AUTHORITY_RUNNING
 -> AUTHORITY_ACCEPTED
 -> BINDING_PENDING
 -> BINDING_RUNNING
 -> BINDING_PASS
 -> MERGING
 -> INTEGRATED
 -> POST_MERGE_VERIFIED
```

Controlled exits are:

```text
AUTHORITY_REJECTED
BINDING_REJECTED
MERGE_RACE
BLOCKED_BY_BOSUN
PARKED_LOOP_GUARD
PARKED_OWNER_REQUIRED
INTEGRATION_CASCADE_BREAKER
```

The transaction identity records at minimum:

- queue entry and objective ID;
- PR number and branch/ref;
- product-semantic head before reconciliation;
- exact frozen candidate SHA and tree;
- exact qualified protected-base SHA and tree;
- preserved focused evidence and invalidation reasons;
- authoritative Sounding Line run/receipt;
- protected-binding run/receipt;
- merge commit and landed tree;
- transaction attempt count and restart reason.

A new candidate SHA starts a new exact transaction identity, but does **not** imply a new product objective, new PR lineage, or new semantic failure.

---

## 3. `AWAITING_AUTHORITY` Is Not Failure

Absence of a sealed authority envelope before authority has completed is a normal pending condition.

The following are normative:

1. `AWAITING_AUTHORITY` and `AUTHORITY_RUNNING` are neutral states.
2. A protected-binding path MUST NOT report a terminal failed Mainline Decision solely because no exact authority envelope exists yet.
3. `Locate sealed explicit authority` is a valid terminal failure only when Nightwatch has recorded that the required exact authority was expected to exist and the expected sealed receipt is absent, malformed, ambiguous, stale, or mismatched.
4. Before authority dispatch, the same condition is `AUTHORITY_PENDING`, not `AUTHORITY_REJECTED`.
5. Bridgewatch and Nightwatch telemetry must render pending authority distinctly from failed authority.
6. Pending-authority observations do not increment product failure fingerprints, maintenance budgets, repeated-failure counters, or successor counts.

This distinction is mandatory because a system must not treat "the prerequisite has not happened yet" as evidence that the prerequisite failed.

---

## 4. Qualification Must Precede Protected Binding

For a normal queue-front product candidate, Nightwatch owns dispatch order:

```text
freeze candidate/base
 -> dispatch authoritative qualification
 -> wait for terminal authority result
 -> if RELEASE_GO, verify identity still exact
 -> dispatch/retrigger protected binding
 -> if BINDING_PASS, merge immediately
```

Protected binding is downstream of authority acceptance.

Pull-request synchronization, ready-for-review, metadata, label, comment, or branch-update events may perform cheap classification/preflight work, but they must not create a misleading terminal binding failure merely because authority is pending.

The preferred long-term GitHub architecture is:

```text
PR event
 -> classification/preflight only

Nightwatch
 -> exact Sounding Line authority dispatch

RELEASE_GO
 -> exact protected-binding dispatch

BINDING_PASS
 -> protected merge
```

A governed `workflow_dispatch` or equivalent exact-input entrypoint for protected binding SHOULD accept:

- PR number;
- candidate SHA;
- candidate ref;
- qualified base SHA.

That entrypoint must retain every existing fail-closed identity, evidence, policy, and branch-protection check. This amendment changes sequencing, not release truth.

---

## 5. Integration Acceptance Lease

When a queue-front candidate reaches `CANDIDATE_FROZEN`, Nightwatch acquires an `INTEGRATION_ACCEPTANCE` lease.

The lease exists to reduce avoidable merge races during the expensive final acceptance window.

While the lease is active:

- Nightwatch MUST NOT intentionally begin another ordinary product integration that can advance protected main before this transaction finishes.
- Bosun may continue local diagnosis and non-conflicting work, but protected maintenance merges that are not P0 prerequisites wait unless policy explicitly allows them to preempt.
- A P0 repository-integrity or security repair may preempt the lease; the current transaction then records `MERGE_RACE/P0_PREEMPTION` and returns to reconciliation.
- External/manual main movement is observed, not prevented. Nightwatch re-evaluates exact identity and does not pretend the old authority is reusable.

The lease should be short-lived. The target is to dispatch binding immediately after `RELEASE_GO` and merge immediately after `BINDING_PASS`, subject to GitHub and Sounding Line completion.

Recommended telemetry:

```text
time_candidate_frozen_to_authority_start
time_release_go_to_binding_start
time_binding_pass_to_merge
main_advances_during_transaction
transaction_restarts
```

Repeated long gaps are an orchestration defect.

---

## 6. Main Movement and Reconciliation Rules

Protected-main movement must not automatically create a new product lineage.

When main advances before authority:

1. inspect the main delta against candidate ownership/impact;
2. reconcile the existing PR exactly once when required;
3. regenerate deterministic artifacts required by the new tree;
4. rerun only evidence invalidated by the semantic delta;
5. freeze one new exact candidate identity;
6. continue the same queue entry and objective.

When main advances after `RELEASE_GO` but before merge:

1. mark the exact transaction `MERGE_RACE`;
2. do not reuse the old authority for a different candidate/base identity;
3. preserve all still-valid evidence;
4. reconcile the same active PR unless a real semantic/conflict reason requires successor lineage;
5. count a transaction restart, not a product failure.

A successor PR is justified only by a real lineage reason such as unresolvable branch corruption, owner-directed replacement, or materially different candidate semantics. Merely receiving a new SHA from reconciliation is not sufficient.

---

## 7. Evidence Preservation Is Semantic, Not Chronological

Nightwatch MUST distinguish Git identity invalidation from evidence invalidation.

An exact authority envelope is SHA/base bound and cannot be reused across a different candidate identity unless Sounding Line explicitly supports a governed carry-forward contract.

However, focused evidence MAY remain valid when Sounding Line proves that the relevant source, contract, fixture, runtime, policy, and dependencies were not semantically invalidated by main movement.

Therefore:

- `main moved` is not by itself permission for a full project requalification;
- unchanged focused evidence should be preserved when current Sounding Line policy permits;
- invalidation reasons must be recorded explicitly;
- broad revalidation without a semantic invalidation reason counts against the no-progress budget;
- Nightwatch should prefer source/tree/contract-bound evidence carry-forward over rerunning identical expensive work.

Sounding Line remains the authority on whether evidence is reusable. Nightwatch owns the decision to avoid rerunning evidence that Sounding Line already considers valid.

---

## 8. Maintenance Cascade Suppression

Nightwatch introduces a first-class **maintenance cascade** concept.

A maintenance cascade exists when one shared defect or one integration prerequisite causes a chain of additional maintenance objectives because the repair itself changes generated state, trusted admission, ownership registration, workflow binding, or another maintenance prerequisite.

Every maintenance objective MUST carry:

- root finding fingerprint;
- parent maintenance objective, if any;
- cascade generation (`0`, `1`, `2`, ...);
- reason the child cannot be included in or deterministically closed with its parent;
- blocked queue entries;
- cumulative PR count;
- cumulative authority attempts;
- cumulative wall time.

Rules:

1. One semantic root finding has one active cascade.
2. Equivalent child findings deduplicate into that cascade.
3. A deterministic generated output caused by a repair should be generated in the same candidate when current governance safely permits it.
4. If anti-self-authorization requires a bootstrap candidate, the bootstrap and its dependent repair remain one compound cascade objective, not two unrelated successes.
5. A repair-of-a-repair does not reset budgets.
6. New PR numbers, SHAs, chats, branches, or slightly different error text do not reset cascade counters.
7. Parallel product chats must attach to the existing cascade instead of independently rediscovering and repairing the same shared defect.
8. A duplicate current-main repair candidate must be closed/superseded once a canonical active repair exists.

---

## 9. Maintenance Amplification Ratio

Nightwatch and Bridgewatch must measure **Maintenance Amplification Ratio (MAR)**.

At minimum:

```text
MAR_pr = maintenance PRs created / product PRs integrated
MAR_merge = maintenance merges / product merges
MAR_time = maintenance integration wall time / product integration wall time
TAR_time = total integration elapsed time / product-value time
CP_share = control-plane active + wait time / total integration elapsed time
```

Nightwatch must also report raw `PRODUCT_VALUE_TIME`, `CONTROL_PLANE_ACTIVE_TIME`, `CONTROL_PLANE_WAIT_TIME`, `EXTERNALLY_BLOCKED_TIME`, and `TOTAL_TRANSACTION_TIME`. A ratio without the underlying durations can hide a twenty-three-hour transaction behind a mathematically elegant shrug.

Metrics must be available per day, per queue-front transaction, per root finding, and rolling program-wide.

The purpose is not to punish legitimate safety work. The purpose is to expose when the verification/control plane consumes more throughput than the product fleet.

Recommended thresholds:

- warning when one product integration causes more than 2 maintenance PRs;
- cascade breaker when one root finding reaches generation 2 without convergence;
- owner review when a queue-front transaction accumulates 3 prerequisite maintenance PRs or 2 protected-main restarts caused by maintenance;
- Tier 1 incident when a repeated control-plane pattern materially prevents product integration across multiple projects or consumes a sustained majority of integration throughput.

An owner may authorize continuation past a breaker, but the authorization does not reset counters or erase incident history.

---

## 10. Total Integration Cost Budget

Every queue-front product objective has one cumulative **Total Integration Cost Budget (TICB)** from first entry into `QUEUE_FRONT` until `POST_MERGE_VERIFIED`, terminal parking, or cancellation.

The budget follows causality, not implementation boundaries. It includes all work and waiting required to land that product candidate, including:

- reconciliation and conflict inspection;
- deterministic generation and registry/index closure;
- focused and broad qualification;
- Sounding Line authority and protected binding;
- every Bosun maintenance, bootstrap, generated-closure, and repair-of-repair descendant;
- browser, accessibility, migration, compatibility, and production-build matrices;
- worktree or environment materialization caused by the transaction;
- GitHub API/rate-limit waits, cooldowns, queue waits, and retry delay;
- main-movement recovery, refreezing, and invalidated evidence refresh;
- post-merge verification and dependent wakeup.

A new PR, SHA, branch, chat, worktree, workflow run, agent, machine, maintenance generation, or renamed failure does not start a new transaction budget.

Nightwatch must track at least:

```ts
type IntegrationCostLedger = {
  transactionId: string;
  startedAt: string;
  elapsedWallClockMinutes: number;
  productValueMinutes: number;
  controlPlaneActiveMinutes: number;
  controlPlaneWaitMinutes: number;
  externallyBlockedMinutes: number;
  descendantMaintenanceMinutes: number;
  authorityMinutes: number;
  browserMatrixMinutes: number;
  retryAndCooldownMinutes: number;
  noProgressCycles: number;
  remainingClosureSteps: string[];
  budgetClass: "STANDARD" | "PREDECLARED_LONG";
  warningAtMinutes: number;
  hardReviewAtMinutes: number;
  breakerAtMinutes: number;
};
```

Elapsed wall clock is measured once from transaction start; parallel tasks do not multiply that clock. Aggregate machine/runtime consumption may also be recorded, but cannot replace elapsed truth.

Default thresholds for an ordinary queue-front integration are:

```text
30 minutes -> INTEGRATION_BUDGET_WARNING
60 minutes -> INTEGRATION_HARD_REVIEW
90 minutes -> INTEGRATION_CASCADE_BREAKER
```

At 30 minutes, Nightwatch must publish the remaining finite closure plan, current blocker, control-plane/product time split, and estimated completion path.

At 60 minutes, Nightwatch MUST NOT create a new descendant PR, start another full authority run, or begin another broad browser matrix until a transaction-level review chooses one of: complete an already-running finite closure step, park safely, or invoke an already-governing emergency/recovery path.

At 90 minutes, the hard breaker trips. No sequence of individually permitted local budgets may override the parent breaker.

Known mandatory long-running suites may use a `PREDECLARED_LONG` budget only when the alternative thresholds, reason, expected evidence, safe cancellation boundary, and absolute cap are declared before the run begins. A long-run class cannot be invented retroactively because an ordinary integration is already late.

Budget exhaustion never authorizes bypass, unsafe merge, stale authority reuse, skipped required evidence, or weakened Sounding Line. The safe result of an exhausted budget is controlled preservation and escalation, not forced release.

Progress means a measurable reduction in remaining closure work: a blocker removed, required evidence completed, candidate/base frozen, authority accepted, binding passed, merge completed, or exact-main proof recorded. Creating another PR, rerunning the same suite, waiting through another cooldown, or obtaining a locally successful repair that leaves the same parent blocker unresolved is activity, not transaction progress.

---

## 11. Global Integration Cascade Breaker and Durable Recovery

The `INTEGRATION_CASCADE_BREAKER` is a parent-transaction circuit breaker. It may trip on elapsed budget, maintenance amplification, repeated no-progress cycles, or a combination.

Default trip/review signals include:

- 90 elapsed minutes for a standard transaction;
- 3 prerequisite maintenance PRs;
- cascade generation 2 without a proven finite closure chain;
- 2 maintenance-caused protected-main restarts;
- 2 equivalent broad authority or browser reruns without semantic invalidation;
- 2 consecutive closure cycles that produce no parent-level progress;
- evidence that the control plane is consuming a sustained majority of the transaction.

When the breaker trips, Nightwatch MUST:

1. preserve the exact product candidate, branch, queue entry, semantic intent, and still-valid evidence;
2. prevent new descendant maintenance PRs, new successor product PRs, new full authority runs, new broad browser matrices, and generic retry dispatch;
3. request cancellation of cancellable work at the next safe unit and stop launching replacement work;
4. release or suspend leases so the fleet is not silently monopolized;
5. record all known blockers, active runs, child lineages, accumulated cost, and last proven good state;
6. classify the escalation against the control plane rather than blaming the preserved product candidate without product evidence;
7. create or attach to one Tier-1 incident/cascade record;
8. require an explicit bounded recovery plan before resumption.

The breaker does not delete work and does not discard valid evidence. It converts an unbounded live transaction into a durable, inspectable, resumable state.

Every long-running Nightwatch-controlled operation must follow the operational pattern already required by Project Drydock for expensive work: it is idempotent, cancellable between safe units, lease-aware, restart-resumable, and tied to exact source/candidate identity. It must have explicit state/time limits and return truthful partial evidence rather than running without a bound.

Failure presentation follows Project Landfall's operational-truth and fallback model: report configured, degraded, unavailable, rate-limited, blocked, or unsupported states honestly; retry temporary conditions only with bounded backoff; retain the last safe context; offer a governed fallback or park state; reject stale evidence; and reconcile rather than replaying success.

A stopped or restarted controller MUST NOT replay a merge, authority acceptance, binding success, or maintenance success merely because an earlier attempt reached a nearby state. Durable recovery resumes from the last verified transition.

The August 20-21 Nightwatch and Wakebook continuation transcripts are mandatory Tier-1 replay evidence. The permanent incident record must retain at least:

- the 7h28 and 23h37 elapsed durations;
- the combined 31h05 control-plane exposure;
- product-value time versus control-plane active/wait time;
- PR/maintenance descendant chains;
- authority and browser reruns;
- cooldown, rate-limit, worktree, and main-movement delays;
- the point at which the new breaker would have tripped;
- the preserved candidate and safe recovery action.

The purpose is not historical theater. It is to prove future Nightwatch behavior terminates the same pattern before the repository spends another day servicing the machinery that is supposed to admit the product.

---

## 12. Compound Maintenance Closure

A shared repair is not complete merely because its source PR merged.

Bosun/Nightwatch must identify deterministic consequences before freeze where practical, including:

- active test registry changes;
- document index changes;
- generated Feature Catalog projections;
- policy/source digests;
- ownership records;
- required focused regression registration;
- protected binding routing/admission consequences.

If those consequences are mechanically derivable and eligible in the same governed candidate, they SHOULD be included and proven before the repair is frozen.

If governance deliberately requires staged bootstrap, Nightwatch records a compound closure plan before the first merge:

```text
root repair
 -> required bootstrap/admission
 -> exact dependent repair
 -> deterministic generated closure
 -> post-merge proof
 -> wake blocked candidates
```

The plan has one root fingerprint and one shared budget. Discovering each expected consequence serially through failed authoritative product runs is prohibited when the consequence could have been determined before dispatch.

---

## 13. Authority and Binding Event Coalescing

Nightwatch and Fairlead should coalesce GitHub events so equivalent state changes do not launch redundant expensive workflows.

Normative requirements:

- metadata-only edits must not be used as a generic retry mechanism when a specific governed dispatch exists;
- repeated PR events for the same candidate/base/authority state deduplicate;
- only one authoritative candidate qualification may be active for one exact candidate/base identity;
- only one binding evaluation may be active for one exact accepted candidate/base identity;
- a previous `AUTHORITY_PENDING` or `BINDING_PENDING` observation is superseded by the later terminal receipt rather than retained as an apparent project failure;
- duplicate runs are recorded as duplicate/no-op operational events and do not create repair objectives.

---

## 14. Queue-Front Preflight Before Expensive Authority

Before dispatching authoritative Sounding Line, Nightwatch performs the cheapest reliable current-tree preflight available for known fleet-wide prerequisites.

Examples include:

- deterministic registry is clean;
- required ownership mapping resolves;
- current Deepwater/policy identity is internally consistent where that is a declared prerequisite;
- no already-open canonical P0 maintenance finding blocks the same acceptance path;
- exact candidate/base/ref identities exist and are stable;
- no conflicting Integration Acceptance lease exists.

This preflight MUST NOT duplicate Sounding Line acceptance or weaken fail-closed behavior. Its purpose is to prevent known deterministic control-plane defects from being rediscovered through a full authoritative product run.

---

## 15. New Failure Classification Rules

The following states are specifically **not** product failures:

- authority has not been dispatched yet;
- authority is currently running;
- binding has not been dispatched yet after `RELEASE_GO`;
- a prior exact authority became stale solely because main moved;
- a current shared Bosun finding blocks qualification before product evidence executes;
- duplicate/obsolete workflow runs for superseded candidate identities.

They are orchestration, waiting, or shared-maintenance states.

A product failure requires evidence tied to product-owned semantics, product-owned tests/contracts, or an owner-classified product defect.

This distinction must be preserved in Bridgewatch metrics and loop budgets.

---

## 16. Bridgewatch Requirements

Bridgewatch must expose the integration transaction, not merely a pile of GitHub checks.

For queue front show:

```text
state
candidate SHA/tree
qualified base SHA/tree
authority state + run
binding state + run
integration lease holder/age
last semantic invalidation
preserved evidence count
rerun evidence count
transaction restarts
main advances during transaction
blocking Bosun cascade
cascade PR count/generation
```

A failed historical run for a superseded identity must not dominate the current status when a newer transaction state exists.

Bridgewatch must separately count:

- product failures;
- shared-maintenance blockers;
- pending authority/binding;
- orchestration races;
- duplicate/no-op workflow activity.

---

## 17. Implementation Roadmap Amendment

This amendment does **not** retroactively move the completion line for the existing Nightwatch Increment A queue/ledger foundation. Increment A may land under its existing accepted scope.

Immediately after Increment A, Nightwatch MUST prioritize **Increment A.1 - Atomic Acceptance Sequencer** before broad unattended fleet integration is considered mature.

### Increment A.1 - Atomic Acceptance Sequencer

Minimum scope:

- transaction states introduced by this amendment;
- exact candidate/base identity ledger;
- `AWAITING_AUTHORITY` neutral state;
- authority-before-binding dispatch order;
- Integration Acceptance lease;
- merge-race handling without automatic successor PR creation;
- exact post-merge proof;
- Bridgewatch transaction projection;
- event/run deduplication hooks through Fairlead;
- the Total Integration Cost Ledger and global breaker;
- safe cancellation, durable parking, and restart-resume without replayed success;
- product-value versus control-plane time projection.

### Increment B - Sounding Line Maintenance Isolation

Increment B retains its v1.0 scope and additionally MUST implement or coordinate:

- protected-binding explicit dispatch/current-source execution where required;
- semantic evidence invalidation/carry-forward contracts;
- qualification-time deterministic generated-state closure where safe;
- pre-authority shared-prerequisite checks;
- pending-vs-failed authority semantics;
- maintenance cascade classification and telemetry;
- predeclared bounds and cancellation hooks for expensive authority/browser work;
- exact partial-evidence and safe-resume contracts after a parent breaker.

### Increment C - Project Bosun

Bosun implementation must satisfy the companion Bosun v1.1 amendment, including repair convergence, compound closure, cascade budgets, and duplicate repair suppression.

---

## 18. Acceptance Tests Added by v1.1

Nightwatch is not operationally mature until automated tests prove at least:

1. a newly reconciled candidate with no authority enters `AWAITING_AUTHORITY` without a terminal failed Mainline Decision;
2. exactly one authority run is dispatched for one frozen candidate/base;
3. binding cannot begin before `RELEASE_GO`;
4. `RELEASE_GO` causes prompt binding dispatch for the same exact candidate/base;
5. `BINDING_PASS` causes prompt protected merge while the Integration Acceptance lease is still valid;
6. main movement before authority causes one JIT reconciliation and preserves still-valid focused evidence;
7. main movement after authority produces `MERGE_RACE`, never silent authority reuse;
8. repeated reconciliation does not create successor PRs without a semantic lineage reason;
9. a pending authority observation does not increment product failure budgets;
10. duplicate GitHub events do not create duplicate authority or binding runs;
11. a generated-registry consequence of a maintenance repair is predicted before dependent product authority when deterministically knowable;
12. one root shared finding cannot create parallel repair objectives in multiple product chats;
13. cascade generation and cumulative budgets survive new PRs/SHAs/chats;
14. Bridgewatch distinguishes pending, failed, shared-blocked, and integrated states;
15. a soak of at least 10 queue-front transactions records MAR and demonstrates no recursive maintenance chain exceeds the configured breaker without explicit owner authorization;
16. replay of the August 20-21 7h28 Nightwatch continuation trips the parent breaker before the historical unbounded descendant chain;
17. replay of the 23h37 Wakebook continuation trips the parent breaker while preserving the existing product candidate and valid evidence;
18. forty individually in-budget child actions cannot evade the cumulative parent transaction budget;
19. new PRs, SHAs, chats, branches, worktrees, controller restarts, and maintenance generations never reset total integration cost;
20. the 30/60/90-minute standard thresholds produce warning, hard review, and breaker states with exact ledger evidence;
21. a `PREDECLARED_LONG` run must declare its alternative cap and cancellation boundary before dispatch and cannot be applied retroactively;
22. breaker entry prevents new descendant PRs, full authority runs, broad browser matrices, and generic retries;
23. in-flight cancellable work stops at a safe unit and resumes idempotently without replaying authority, binding, merge, or success;
24. Bridgewatch reports product-value time, control-plane active time, wait time, total elapsed time, remaining closure steps, and breaker state truthfully;
25. degraded, rate-limited, blocked, and partial-evidence states remain visible and never collapse into a decorative success state.

---

## 19. Immediate Operational Rule

Until Increment A.1 is fully implemented, every Nightwatch/Codex integration continuation must follow this manual-equivalent contract.

Before step 1, establish or inherit the parent Total Integration Cost Ledger. If the standard transaction has already reached its hard-review or breaker threshold, do not restart the sequence under a new chat, PR, SHA, or worktree. Park or resume only under the recorded bounded recovery plan.

```text
1. establish live main
2. reconcile queue front once
3. refresh only invalidated deterministic/focused evidence
4. freeze exact candidate/base
5. run exact authority
6. wait for terminal authority
7. if RELEASE_GO, immediately bind exact identity
8. if BINDING_PASS, immediately merge
9. prove landed main
```

Do not intentionally start binding at step 4 merely to observe that step 5 has not happened yet.

Do not start a new shared repair for an already-known canonical finding.

Do not let a maintenance child reset the parent cascade budget.

Do not interpret "still inside this child operation's allowance" as permission to exceed the parent transaction's absolute cap.

---

## 20. Governance

This amendment does not grant Nightwatch release authority. Sounding Line remains the sole authority for verification truth, `RELEASE_GO`, maintenance acceptance, and protected-binding evidence validity.

This amendment does not permit bypassing branch protection, reusing stale authority, suppressing real failed tests, or treating unknown impact as safe.

It governs **when** Nightwatch asks the existing authorities to act, how the transaction is represented, how evidence and failures are classified, how total integration cost is bounded, and how repeated maintenance is prevented from recursively consuming the fleet.

Project Landfall's operational-truth and bounded-fallback requirements and Project Drydock's durable/cancellable bounded-work requirements are adopted here as cross-project operating precedent. They do not transfer domain ownership; they establish the same platform expectation that degraded work is truthful, long work is bounded, and recovery preserves safe state without replaying success.

> **The integration controller must not create failure by asking the final question before it has performed the prerequisite step. The maintenance controller must not create an endless job preserving the maintenance controller.**

---

**End of Project Nightwatch v1.1 Amendment**
