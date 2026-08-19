---
title: Project Nightwatch - Engineering Operations, Integration, and Unattended Autonomy Orchestrator
audience: engineering
status: governing-baseline-candidate
canonical_for: project-nightwatch-v1
version: "1.0"
last_reviewed: 2026-08-19
repository_baseline: d7e3f2f873139e3f7353bf288124f50543ce2aac
---

# PROJECT NIGHTWATCH

## The Engineering Operations, Integration, and Unattended Autonomy Orchestrator

**Governing Architecture, Operational Safety, Integration Flow, and Product Requirements Document**

**Version:** 1.0  
**Date:** August 19, 2026  
**Status:** Governing baseline candidate, revised three-lane edition  
**Repository baseline reviewed:** `Kgray44/treasurehuntSoT` at `d7e3f2f873139e3f7353bf288124f50543ce2aac`

> **Governing Principle**  
> Keep the engineering fleet productive. Develop features in parallel, integrate finished work through a governed just-in-time queue, maintain shared infrastructure continuously, and never allow one pathological objective, stale candidate, validation defect, migration collision, or maintenance loop to consume the useful capacity of the whole program.

---

## 1. Executive Summary

Project Nightwatch began as the response to one severe unattended-automation incident: an overnight Codex objective repeatedly repaired prerequisites, refroze candidates, created successor pull requests, and consumed remaining quota without completing the requested product merge. That founding incident remains permanent program evidence.

The later repository-wide integration audit exposed a broader constraint. Voyagewright's **implementation throughput now exceeds its integration and maintenance throughput**. Major project branches can be locally complete, heavily tested, and functionally substantial while protected `main` advances through verification, registration, generated-ledger, browser-fixture, and authority-maintenance work. Parallel feature implementation is healthy. Parallel attempts to keep every finished candidate continuously synchronized with moving `main` are not.

Nightwatch v1.0 therefore expands from an overnight loop guard into the **engineering operations orchestrator** for both interactive and unattended development. It establishes three distinct lanes:

1. **Product Fleet**: Admiralty, Wakebook, Drydock, Helm, Shipwright, Tideglass, Bridgewatch, and other project owners implement features in parallel.
2. **Integration Lane**: locally complete candidates enter a serialized Integration Queue. Only the queue-front candidate performs just-in-time reconciliation, deterministic regeneration, focused requalification, Sounding Line acceptance, protected merge, and exact-main proof.
3. **Project Bosun**: a subordinate autonomous maintenance service continuously detects, classifies, repairs, verifies, and closes bounded shared-infrastructure defects without hijacking product project scope.

The operating rule is:

> **Develop in parallel. Integrate from a queue. Reconcile only at the front. Repair shared infrastructure in a separate bounded maintenance lane.**

Nightwatch remains an orchestrator, not a release authority. Sounding Line alone governs verification truth and protected acceptance. Fairlead owns GitHub interaction and quota-efficient mechanics. Project Trim owns Codex context and inference efficiency. Bridgewatch provides Mission Control visibility. Project Bosun is subordinate to Nightwatch and owns maintenance execution, never product semantics.

---

## 2. Founding Tier 1 Incident

### 2.1 Identity

| Field | Value |
|---|---|
| Incident | `INC-T1-2026-08-19-RUNAWAY-ITERATION-001` |
| Class | Runaway unattended iterative loop |
| Reviewed lineage | PR `#302` through PR `#334` |
| Final reviewed main | `d7e3f2f873139e3f7353bf288124f50543ce2aac` |
| New PRs in lineage | 33 |
| Merged supporting repairs | 6 |
| Closed without merge | 23 |
| Primary product objective merged | No |

Supporting maintenance that did land included browser-fixture partitioning, Shipwright browser isolation, Shipwright engine registration, browser-selection normalization, governed Shipwright runner admission, and generated P34 ledger admission.

PR `#334`, the last reviewed product successor, had expanded to 32 changed files with 1,671 additions and 1,089 deletions. Its Sounding Line plan passed, but Wave 0 failed and the finalizer returned `SOUNDING_LINE_FINALIZER_WAVE_0_PREREQUISITES_INVALID`. Failed receipts spanned accessibility, animation lifecycle, Community, Passport, Player Journal, Player Library, responsive Chromium/WebKit, and Studio. A responsive receipt exposed the Shipwright runner attempting to invoke Git inside an isolated validation mirror that intentionally was not a Git worktree.

The lesson is not that Sounding Line should have accepted the candidate. Sounding Line correctly failed closed. The control-plane failure was that a product lineage repeatedly adopted shared defects and regenerated itself rather than transferring shared repair work to its canonical owner and parking when bounded attempts were exhausted.

Nightwatch must prevent recurrence through budgets, semantic failure fingerprints, one-active-candidate rules, scope-growth breakers, shared-defect ownership, and a productive fallback queue.

---

## 3. Constraint Migration and the Current Integration Bottleneck

Voyagewright has repeatedly improved its dominant bottleneck:

- Sounding Line improved verification throughput and release truth.
- Sounding Line v1.4 reduced broad mainline overvalidation through impact selection and evidence preservation.
- Project Trim reduced repeated Codex archaeology and context waste.
- Project Fairlead addresses GitHub API quota and redundant interaction.
- Nightwatch addresses runaway objective persistence.

Each improvement raises overall throughput until the next constraint becomes visible. The current constraint is **admission of finished work onto `main` while maintaining the shared railway**.

Recent project branches demonstrated the pattern: large completed implementations could remain dozens of commits behind current `main` while mainline activity consisted heavily of maintenance and verification infrastructure. Several parallel projects also independently reserved the same MySQL migration number, including multiple branches that believed `0058` was the next canonical migration.

The governing response is not to serialize development. It is to separate **parallel development** from **serialized canonical integration** and to automate shared maintenance.

---

## 4. Non-Negotiable Design Principles

- **Parallel development remains the default.** Product projects should not stop merely because another candidate owns protected integration.
- **Integration is serialized and just-in-time.** Finished candidates queue instead of repeatedly chasing `main`.
- **One active candidate per objective.** Successor PRs are bounded and lineage-accounted.
- **Shared defects have shared owners.** A product project may report a shared infrastructure defect. It may not adopt it unless it owns that subsystem.
- **Product scope does not metastasize into maintenance scope.** Validation discoveries become Bosun findings where appropriate.
- **Sounding Line remains final authority.** Nightwatch and Bosun cannot fabricate, weaken, or replace evidence.
- **Fairlead owns GitHub mechanics.** Nightwatch describes intent; Fairlead chooses the least expensive correct GitHub mechanism.
- **Project Trim owns context efficiency.** Automation may request Codex, but should give it minimum sufficient context with autonomous targeted expansion.
- **Deterministic work stays deterministic.** Do not invoke Codex to perform a simple generated-registry refresh if a governed script can do it safely.
- **AI is invoked on demand, not kept thinking continuously.** Idle maintenance should cost almost no inference.
- **Budgets are external to the working agent.** The agent cannot silently extend its own time, PR, mutation, candidate, or cost limits.
- **Restart safety is mandatory.** Reboot, context compaction, or new chat does not erase counters or lineage.
- **Bridgewatch must show truth, not merely activity.** Missing sources, maintenance blockers, stale candidates, and owner-required work must be explicit.

---

## 5. Canonical Ownership Boundaries

| System | Canonical ownership |
|---|---|
| Project Nightwatch | Engineering orchestration, objective scheduling, Integration Queue, budgets, leases, migration reservations, Bosun supervision |
| Project Bosun | Bounded repository maintenance execution under Nightwatch |
| Sounding Line | Test design policy, evidence validity, execution planning, maintenance qualification, Mainline Decision, `RELEASE_GO` |
| Project Fairlead | GitHub interaction, rate-state coordination, caching, request routing, quota-aware mechanics |
| Project Trim | Codex context packets, accepted capsules, inference and token efficiency |
| Bridgewatch | Read-only Mission Control, integration/maintenance visibility, alerts, historical telemetry |
| Deepwater | Capability realization audit and ownership findings |
| Product projects | Product semantics, business logic, migrations and tests belonging to their owned feature scope |
| Breakwater | Deployment, infrastructure, release consumption, service operations |

Nightwatch coordinates these systems. It does not fork their authority.

---

## 6. Three-Lane Engineering Operating Model

```text
                 PRODUCT FLEET
    Admiralty  Wakebook  Drydock  Helm  Shipwright ...
                       |
                 LOCALLY_COMPLETE
                       v
                INTEGRATION QUEUE
                       |
                 queue-front only
                       |
        JIT reconcile -> qualify -> Sounding Line
                       |
                  protected main

                 PROJECT BOSUN
   shared baseline | drift | migration | stale PR | runtime
                       |
       detect -> classify -> bounded repair -> focused proof
                       |
                   Sounding Line
                       |
                   Fairlead
                       |
                  protected main
```

Product work and Bosun maintenance may proceed concurrently when leases and ownership permit. Canonical acceptance remains serialized unless Sounding Line explicitly provides a governed merge-train capability.

---

## 7. Nightwatch Runtime Controller

The preferred runtime is one deterministic controller, conceptually `nightwatchd`, rather than one daemon per project.

Logical components:

1. **Session/Plan Validator**: validates interactive day plans and unattended Night Plans.
2. **Work Dispatcher**: schedules product, integration, maintenance, fallback, and report objectives.
3. **Integration Queue Manager**: owns queue state, fairness, dependencies, and queue-front transitions.
4. **Objective Controller**: owns bounded attempts, states, counters, and material-progress timing.
5. **Migration Reservation Manager**: atomically assigns canonical migration identities/ranges.
6. **Lease Broker**: owns source-write, migration, registry, browser-runtime, and GitHub-operation leases.
7. **Loop Guard**: failure fingerprints, successor caps, alternating-loop detection, scope-growth breakers.
8. **Bosun Engine**: detectors, classifier, maintenance queue, deterministic jobs, Codex worker adapter, repair handoff.
9. **Persistent Ledger**: restart-safe state, receipts, lineage, budgets, queue positions, maintenance history.
10. **Bridgewatch Projection**: read-only operational state.

Bosun is a Nightwatch department, not a second orchestration authority.

---

## 8. Product Fleet Lifecycle

Canonical product candidate states:

```text
IMPLEMENTING
 -> LOCALLY_COMPLETE
 -> QUEUE_READY
 -> QUEUED
 -> QUEUE_FRONT
 -> RECONCILING
 -> QUALIFYING
 -> ACCEPTANCE_PENDING
 -> INTEGRATED
 -> POST_MERGE_VERIFIED
```

Exceptional states:

```text
BLOCKED_BY_BOSUN
PARKED_OWNER_REQUIRED
PARKED_LOOP_GUARD
SUPERSEDED
WITHDRAWN
```

When a phase becomes locally complete, normal feature development freezes. It must not repeatedly reconcile because `main` moved while it waits. The candidate records its source identity, local base, focused evidence, shared file classes, migration reservations, dependencies, known blockers, and ready timestamp, then enters the Integration Queue.

---

## 9. Integration Queue

### 9.1 Queue Entry Contract

A queue record contains at least:

```yaml
candidateId: wakebook-p2
project: Project Wakebook
increment: Phase 2
branch: codex/project-wakebook-phase2-bind-the-voyages
productHead: <sha>
localBase: <sha>
readySince: <timestamp>
priority: NORMAL
state: QUEUED
migrationReservations: []
sharedFileClasses: []
requiredOwners: []
knownBlockers: []
focusedEvidence: []
```

### 9.2 Queue-Front Rule

Only `QUEUE_FRONT` may perform the expensive sequence:

```text
fresh origin/main
 -> semantic/conflict delta inspection
 -> migration reservation confirmation or bounded renumbering
 -> deterministic generated-state refresh
 -> focused requalification
 -> freeze exact candidate
 -> Sounding Line Mainline Decision
 -> protected merge
 -> exact-main proof
```

Candidates behind the front remain frozen. `main` movement alone does not trigger rebase or requalification.

### 9.3 Ordering

Ordering may consider explicit priority, age/fairness, dependency order, migration dependencies, number of downstream candidates unblocked, risk, maintenance prerequisites, and Sounding Line train policy. Large candidates must not permanently starve small eligible ones. Emergency work may preempt only under explicit policy.

### 9.4 Queue-Front Blocker

If the front candidate becomes blocked by shared infrastructure:

1. classify the blocker;
2. create/attach a Bosun finding;
3. freeze the product candidate;
4. optionally advance another independent candidate when policy allows;
5. resume the blocked candidate only after the shared repair lands and the blocker is proven removed.

---

## 10. Migration Reservation Ledger

Parallel branches must not infer the next migration number from stale branch history.

> **Every migration-producing objective reserves canonical identities before committing migration files.**

Reservation fields include reservation ID, project, increment, objective, database family, exact IDs or ranges, count, state, timestamps, and expiry.

Example:

```text
Admiralty P3  -> MySQL 0068-0069
Shipwright P3 -> MySQL 0070-0071
Drydock P4    -> MySQL 0072-0075
```

Desired tooling may resemble:

```text
npm run migrations:reserve -- --project shipwright --count 2
```

The exact CLI is implementation-specific. Atomic non-overlap, auditability, expiration, and Bridgewatch visibility are normative. Queue-front renumbering is a fallback, not normal workflow.

---

## 11. Shared Baseline Health

Product candidates must not be the primary monitoring mechanism for shared runtime health.

Nightwatch schedules continuous or change-triggered shared-baseline verification through Sounding Line/Bosun for families such as:

- `browser.shared-shell`
- `browser.auth-sentinel`
- `browser.navigation-sentinel`
- `browser.shared-fixtures`
- `browser.accessibility-foundation`
- `browser.runtime-environment`
- `validation-mirror-contract`
- `registry-determinism`

A degraded shared baseline becomes a Bosun finding before another unrelated product candidate discovers it during final acceptance.

The normal principle is:

> A product candidate should primarily discover its own regressions, not learn that the airport's landing lights have been dead since breakfast.

---

## 12. Sounding Line Maintenance Isolation Requirements

Nightwatch depends on, but does not itself implement, the following Sounding Line capabilities:

1. ordinary candidates run project-owned, semantically affected, and required global sentinel proof;
2. release candidates remain exhaustive where policy requires;
3. project-owned ordinary test registration uses a declarative fail-closed contract when ownership and risk are provable;
4. authority semantics, finalizers, release policy, and trusted boundary changes remain protected maintenance;
5. deterministic generated artifacts should be produced at qualification when safe, and sealed by generator/input/output identity;
6. shared maintenance candidates are independently classified and cannot self-authorize.

Unknown ownership or impact expands proof. It never justifies omission.

---

## 13. Objective Classes and Budgets

Nightwatch objectives may be `PRIMARY`, `SECONDARY`, `FALLBACK`, `HOUSEKEEPING`, `MAINTENANCE`, `INTEGRATION`, or `REPORT_ONLY`.

Recommended product defaults:

```json
{
  "wallClockLimitMinutes": 90,
  "maxNewPullRequests": 5,
  "maxActiveCandidates": 1,
  "maxCandidateRefreezes": 2,
  "maxPrerequisitePullRequests": 2,
  "maxRepeatedFailureSignatures": 2,
  "maxProtectedMainRestarts": 2,
  "maxFullValidationRuns": 2,
  "noMaterialProgressMinutes": 45,
  "maxScopeGrowthRatio": 2.0
}
```

Bosun reasoning objectives normally receive tighter limits, for example 30-minute warning and 45-minute park, one active repair candidate, and no more than two semantic failure repetitions.

The most restrictive applicable boundary wins. Missing exact credit telemetry never means unlimited usage.

---

## 14. Material Progress, Failure Fingerprints, and Loop Guard

Material progress includes requested deliverable completion, a necessary prerequisite merge, a newly removed blocker, authoritative qualification advancement, reduction in open/superseded PRs, or root-cause evidence that materially changes the next action.

Non-progress includes recreating equivalent candidates, repeating unchanged tests, rereading unchanged logs, renaming branches, creating a new PR number for the same semantic state, or growing scope merely because another defect was discovered.

Failure fingerprints normalize objective family, authority mode, failed workflow/job/step, stable semantic error class, affected contract/path class, candidate lineage, protected-base relationship, and repair category.

Counters cannot be reset by a new branch, PR, chat, objective ID, wording change, or close/reopen cycle.

Default response:

- first occurrence: diagnose and permit one bounded repair;
- second equivalent occurrence: park;
- same failure after a repair claimed to fix it: park immediately unless new evidence proves a distinct cause.

Alternating patterns such as `A -> B -> A -> B` are loops too.

---

## 15. Shared-Defect Ownership Rule

> **A product project may report a shared infrastructure defect. It may not adopt it unless it owns that subsystem.**

Example:

```text
Tideglass candidate
 -> discovers Shipwright governed runtime Git-worktree assumption
 -> BLOCKED_BY_BOSUN: MW-00418

Bosun
 -> repairs Shipwright validation runtime in isolated maintenance worktree
 -> focused proof
 -> Sounding Line
 -> protected merge

Tideglass
 -> resumes qualification against repaired main
```

This rule prevents a narrow product candidate from absorbing Shipwright, Sounding Line, Deepwater, registry, and unrelated infrastructure changes into one sprawling envelope.

---

## 16. Candidate and PR Lineage

Each deliverable has at most one active product candidate. A successor must record predecessor, terminal reason, effective diff relationship, new base/head, and remaining budget. The default permits at most two product successors.

When a successor is valid, Fairlead/Bosun should close the predecessor, link the lineage, preserve the terminal reason, and schedule branch cleanup. Superseded objects remain historical evidence, not active operational state.

---

## 17. Project Bosun Relationship

Project Bosun is formally:

> **The Autonomous Repository Maintenance and Repair Service**

It is a subordinate Nightwatch subsystem. Bosun owns:

- maintenance finding normalization and deduplication;
- maintenance risk classification;
- repair queue and priority;
- isolated maintenance worktrees;
- deterministic `AUTO_0` operations;
- bounded Codex `AUTO_1` and `AUTO_2` repair workers;
- focused verification coordination;
- post-merge verification and dependent-candidate wakeup;
- maintenance receipts and Bridgewatch telemetry.

Bosun does **not** own:

- `RELEASE_GO`;
- Sounding Line authority semantics;
- product business logic outside an owning repair scope;
- user-support diagnosis, which belongs to Admiralty's support architecture;
- GitHub quota mechanics, which belong to Fairlead;
- deployment operations, which belong to Breakwater.

One preferred runtime controller, `nightwatchd` or equivalent, hosts both Nightwatch orchestration and Bosun maintenance. Avoid a fleet of competing always-on daemons.

---

## 18. Bosun Automation Classes

Nightwatch recognizes these maintenance classes:

| Class | Meaning | Typical action |
|---|---|---|
| `AUTO_0` | deterministic mechanical housekeeping | governed script, no Codex |
| `AUTO_1` | bounded low-risk engineering repair | isolated Codex repair + focused proof |
| `AUTO_2` | trusted/protected maintenance | Codex may implement; separate maintenance authority required |
| `OWNER` | semantic, security, destructive, or major-governance decision | park and request owner decision |
| `BLOCKED` | unavailable external dependency or unsafe precondition | preserve and wait |

`AUTO_0` examples include deterministic registry/index regeneration, expired task-root cleanup, stale lease release, safe superseded-PR closure, and idempotent generated-state reconciliation.

`AUTO_1` examples include stale fixtures, governed runners incorrectly assuming `.git`, bounded browser assertions, cleanup defects, and ordinary owned adapter repairs.

`AUTO_2` examples include trusted registration boundaries, narrow worker/resource policy, or protected validation-runtime changes.

`OWNER` includes release-semantic changes, weakened evidence, security authorization, destructive migrations, privileged access widening, or broad governance changes.

---

## 19. Maintenance Capacity

Initial recommended capacity:

- up to two deterministic `AUTO_0` operations concurrently when scopes do not overlap;
- one Codex `AUTO_1/AUTO_2` reasoning repair at a time;
- one protected maintenance-authority operation at a time;
- product development remains higher priority for scarce browser/database/build resources unless a P0 maintenance issue blocks the fleet.

If no maintenance exists, the reasoning slot consumes no inference merely to remain awake.

---

## 20. Leases and Mutation Governance

Nightwatch/Bosun leases may include:

- `SOURCE_WRITE`
- `MIGRATION_RANGE`
- `SOUNDING_LINE_POLICY`
- `BROWSER_RUNTIME`
- `GENERATED_REGISTRY`
- `GITHUB_PR_LINEAGE`
- `INTEGRATION_ACCEPTANCE`

A lease contains objective, scope, owner, expiration, mutation budget, allowed authority class, and state. Expired or out-of-scope operations fail closed.

No product project and Bosun repair may mutate the same owned surface simultaneously without a governed coordination rule.

---

## 21. Persistent Ledger and Restart Recovery

The persistent Nightwatch state should record sessions, candidates, Integration Queue state, migration reservations, objectives, leases, Codex runs, verification runs, failure fingerprints, budgets, maintenance findings/history, and events. A local SQLite store such as `.nightwatch/nightwatch.sqlite` is an acceptable implementation shape when kept untracked and privacy-safe.

After restart:

1. reload ledger;
2. fetch current repository/GitHub truth;
3. reconcile active processes, worktrees, PRs, and leases;
4. expire dead ownership without resetting history;
5. resume the next safe state.

Restart is recovery, not amnesia.

---

## 22. Project Trim and Codex Efficiency

Nightwatch/Bosun consume Project Trim context packets, accepted phase capsules, read/search ledgers, and autonomous targeted context expansion. A Bosun Codex worker receives a narrow task contract, not the entire repository history.

Example:

```text
MAINTENANCE OBJECTIVE MW-00418
Class: AUTO_1
Owner: Shipwright validation runtime
Problem: governed runner invokes Git in isolated validation mirror
Allowed paths: scripts/shipwright/** and directly affected tests
Forbidden: product behavior, release semantics, unrelated projects
Success: reproduce, repair root cause, focused green proof, coherent candidate
Do not perform authoritative acceptance yourself.
```

The deterministic controller decides when reasoning is required. Codex is not kept continuously active waiting for defects.

---

## 23. Fairlead and GitHub Logistics

Nightwatch/Bosun declare GitHub intent. Fairlead should execute GitHub reads/mutations through the least expensive correct mechanism, coordinate rate limits across worktrees, coalesce requests, use cache/conditional retrieval, and degrade safely when a quota pool is exhausted.

Bosun must not build a second direct polling farm behind Fairlead's back.

---

## 24. Bridgewatch Mission Control

Bridgewatch should expose first-class Nightwatch and Bosun data:

### Nightwatch / Integration

- active product projects;
- locally complete candidates;
- Integration Queue order and age;
- queue-front candidate;
- candidate divergence;
- migration reservations/collisions;
- reconciliation attempts;
- Sounding Line acceptance state;
- completed, parked, superseded, and owner-required work.

### Bosun Station

Recommended station name: **Bosun** or **Bosun's Deck**.

Show:

- active maintenance objective;
- class and risk;
- source subsystem;
- blocked candidates/projects;
- age and budget;
- Codex state;
- unique failure fingerprint;
- active lease;
- focused verification;
- candidate successors;
- automatic-resolution rate;
- mean repair time;
- projects unblocked;
- blocking hours avoided;
- Codex credits/tokens when telemetry exists;
- recurring failure classes;
- owner escalations;
- shared-baseline health.

Missing telemetry is itself an explicit source-health condition.

---

## 25. Security and Safety

- Nightwatch/Bosun never store credentials or private chat/user content in repository records.
- Public repositories receive sanitized operational evidence only.
- Maintenance workers use least privilege and task-owned worktrees/resources.
- Codex does not classify its own authority; classification comes from protected policy.
- Unknown ownership, impact, or risk broadens verification or escalates. It never grants more autonomy.
- No repair may weaken Sounding Line or branch protection to make itself easier to merge.
- No maintenance repair may cross into user-support private data. Admiralty governs support grants and user-authorized diagnosis.
- Destructive actions require explicit policy and owner authorization where specified.

---

## 26. Prompt and Mandate Safety

Phrases such as "run all night", "do not stop", "retry until successful", or "continue through every blocker" are valid only when Nightwatch has external budgets and circuit breakers.

The safe meaning of unattended continuation is:

> Continue useful authorized work across the complete work plan. Do not continue one pathological objective indefinitely.

If conservation and unlimited persistence conflict, the most restrictive safe boundary wins.

---

## 27. Implementation Roadmap

Nightwatch v1.0 adopts three short implementation increments while the product fleet continues working.

### Increment A: Integration Queue and Migration Reservations

Implement:

- machine-readable Integration Queue;
- candidate lifecycle and queue-front rule;
- one-active-candidate-per-objective enforcement;
- JIT reconciliation;
- migration reservation ledger and allocator;
- basic Bridgewatch queue/migration projection.

**End state:** finished work waits cheaply rather than continuously rebasing.

### Increment B: Sounding Line Maintenance Isolation

Through Sounding Line's own authority, implement:

- canonical shared browser/runtime baseline watch;
- owner/impact-isolated ordinary acceptance;
- declarative ordinary project test registration;
- qualification-time deterministic generated artifacts where safe;
- maintenance-work classification and protected maintenance boundaries.

**End state:** shared validation problems are detected and repaired independently rather than being discovered by random product candidates.

### Increment C: Project Bosun

Implement:

```text
detect -> normalize -> dedupe -> classify -> queue -> lease
 -> AUTO_0 or Codex
 -> focused proof
 -> Sounding Line
 -> Fairlead
 -> protected merge
 -> post-merge verify
 -> wake dependents
```

Include restart recovery, budgets, Bridgewatch Bosun station, and bounded owner escalation.

**End state:** the third lane is real and small shared defects can be resolved without KG manually starting emergency repair chats.

---

## 28. Final Acceptance Criteria

Nightwatch v1.0 is accepted only when:

1. product development continues in parallel while canonical integration remains governed;
2. locally complete candidates enter a persistent Integration Queue;
3. non-front candidates do not continually reconcile because `main` moved;
4. only queue-front work performs JIT reconciliation and final qualification;
5. migration identities/ranges cannot collide across parallel branches under the governed allocator;
6. one active product candidate exists per objective;
7. shared infrastructure defects are transferred to canonical maintenance ownership rather than absorbed by unrelated product scope;
8. Bosun deterministic maintenance can run without Codex;
9. Bosun reasoning repairs are bounded, isolated, and budgeted;
10. semantic/high-risk changes escalate instead of self-authorizing;
11. Sounding Line remains the only release/maintenance acceptance authority;
12. Fairlead owns GitHub mechanics and quota coordination;
13. Project Trim supplies minimum sufficient Codex context;
14. Bridgewatch shows authoritative queue, maintenance, budgets, blockers, and source health;
15. restart does not reset counters, leases, queue positions, or lineage;
16. the founding `#302-#334` incident replay parks the pathological product lane before excessive churn and continues independent useful work;
17. a shared failure equivalent to the PR `#334` Shipwright validation-mirror defect is transferred to Bosun, repaired once, verified, merged, and used to resume the blocked product candidate without product-scope metastasis.

The success condition is:

> **One break no longer stops the factory, and one finished product no longer needs to chase the factory while waiting for inspection.**

---

## 29. Default Thresholds

| Metric | Warning | Default action limit |
|---|---:|---:|
| Product objective wall time | 60 min | park at 90 min |
| Bosun AUTO_1 wall time | 30 min | park at 45 min |
| No material progress | 20 min | park at 45 min |
| Same semantic failure | first repeat | park at second equivalent occurrence |
| Product successors | 1 | owner required before third |
| Bosun repair successors | 1 | park before third |
| Prerequisite PRs | 1 | park before third |
| New PRs in one lineage | 3 | park at 5 |
| Active product candidates/objective | N/A | reject above 1 |
| Protected-main reconciliation restarts | 1 | park after 2 |
| Full authority attempts without progress | 1 | park after 2 |
| Scope growth | 125% | park at 200% or +10 files |
| Bosun reasoning concurrency | 1 | increase only from measured evidence |
| Deterministic maintenance concurrency | 2 | increase only with non-overlap proof |
| Protected maintenance authority concurrency | 1 | do not exceed by default |

---

## 30. Example Shift Handoff

```text
PROJECT NIGHTWATCH - SHIFT HANDOFF

Starting main: <sha>
Ending main:   <sha>

PRODUCT FLEET
- Admiralty P3: IMPLEMENTING
- Drydock P4: QUEUE_READY
- Wakebook P2: QUEUED position 2

INTEGRATED
- Bridgewatch v2 P1: merged PR #...

BOSUN COMPLETE
- MW-00418: Shipwright isolated-runtime Git assumption repaired
- MW-00421: deterministic registry drift reconciled
- 4 superseded PRs closed

OWNER REQUIRED
- MW-00423: proposed release-authority semantic change
  Class: OWNER
  No mutation performed

INTEGRATION QUEUE
1. Drydock P4 - qualifying
2. Wakebook P2 - frozen, no repeated reconciliation

No security bypass, protection change, or unapproved paid overage occurred.
```

---

## 31. Governance and Change Control

Nightwatch cannot modify its own budget, lease, or authority rules and use the modified behavior to qualify that same change. Sounding Line, Fairlead, Trim, Bridgewatch, Breakwater, and product ownership changes must follow their canonical governance.

Project Bosun has a subordinate governing specification. Where Nightwatch and Bosun differ, Nightwatch controls orchestration and budget semantics; Sounding Line controls verification and acceptance; product subsystem governance controls business semantics.

Thresholds may be tuned only from measured evidence with explicit exposure analysis and owner-approved governance where required.

---

## 32. Glossary

| Term | Definition |
|---|---|
| Product Fleet | Parallel feature/project development lane |
| Integration Queue | Persistent serialized queue of locally complete candidates |
| Queue Front | Candidate currently authorized for JIT reconciliation and acceptance |
| JIT reconciliation | Reconcile only when a candidate reaches canonical acceptance |
| Migration Reservation | Central allocation preventing parallel migration-ID collisions |
| Bosun | Autonomous Repository Maintenance and Repair Service subordinate to Nightwatch |
| Maintenance Finding | Normalized evidence that shared repository maintenance may be needed |
| Material Progress | Objective advancement, not mere activity |
| Failure Fingerprint | Semantic identity of a failure across changing surface details |
| Park | Preserve and suspend bounded work without losing state |
| Execution Lease | Time/scope-bounded mutation authorization |
| Watch Ledger | Restart-safe operational state for Nightwatch/Bosun |
| Shared Baseline | Canonical common runtime/browser/infrastructure health watched independently from product candidates |

---

**End of Project Nightwatch Governing Document v1.0 - Revised Three-Lane Edition**
