---
title: Project Nightwatch - Engineering Operations, Integration, and Unattended Autonomy Orchestrator
audience: engineering
status: governing
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
**Status:** Governing baseline, revised three-lane edition
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

- Parallel development remains the default.
- Integration is serialized and just-in-time.
- One active candidate exists per objective.
- Shared defects have shared owners.
- Product scope does not metastasize into maintenance scope.
- Sounding Line remains final authority.
- Fairlead owns GitHub mechanics.
- Project Trim owns context efficiency.
- Deterministic work stays deterministic.
- AI is invoked on demand, not continuously.
- Budgets are external to the working agent.
- Restart safety is mandatory.
- Bridgewatch must show truth, not merely activity.

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

1. Session/Plan Validator
2. Work Dispatcher
3. Integration Queue Manager
4. Objective Controller
5. Migration Reservation Manager
6. Lease Broker
7. Loop Guard
8. Bosun Engine
9. Persistent Ledger
10. Bridgewatch Projection

Bosun is a Nightwatch department, not a second orchestration authority.

---

## 8. Product Fleet Lifecycle

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

Exceptional states: `BLOCKED_BY_BOSUN`, `PARKED_OWNER_REQUIRED`, `PARKED_LOOP_GUARD`, `SUPERSEDED`, `WITHDRAWN`.

When a phase becomes locally complete, ordinary feature work freezes and the candidate enters the Integration Queue. `main` movement alone does not justify repeated rebase/requalification.

---

## 9. Integration Queue

A queue entry records project/increment, branch, product head, local base, ready time, priority, migration reservations, shared-file classes, owners, blockers, and focused evidence.

Only queue front performs:

```text
fresh origin/main
 -> semantic/conflict delta inspection
 -> migration confirmation
 -> deterministic generated-state refresh
 -> focused requalification
 -> freeze exact candidate
 -> Sounding Line
 -> protected merge
 -> exact-main proof
```

Ordering considers priority, fairness/age, dependencies, migration ordering, downstream unblock value, risk, and maintenance prerequisites. Large candidates cannot starve smaller eligible work indefinitely.

If queue front is blocked by shared infrastructure, Nightwatch attaches/creates a Bosun finding, freezes the product candidate, may advance another independent candidate when policy allows, and resumes only after repair postconditions are proven.

---

## 10. Migration Reservation Ledger

Every migration-producing objective reserves canonical IDs/ranges before committing migration files.

```text
Admiralty P3  -> MySQL 0068-0069
Shipwright P3 -> MySQL 0070-0071
Drydock P4    -> MySQL 0072-0075
```

A desired CLI may resemble `npm run migrations:reserve -- --project shipwright --count 2`. Exact syntax is implementation-specific. Atomic non-overlap, auditability, expiry, and Bridgewatch visibility are normative. Queue-front renumbering is a fallback, not normal workflow.

---

## 11. Shared Baseline Health and Sounding Line Isolation

Product candidates are not the primary shared-runtime monitor. Shared baseline families may include `browser.shared-shell`, `browser.auth-sentinel`, `browser.navigation-sentinel`, `browser.shared-fixtures`, `browser.accessibility-foundation`, `browser.runtime-environment`, `validation-mirror-contract`, and `registry-determinism`.

Nightwatch depends on Sounding Line to provide owner/impact-isolated ordinary acceptance, exhaustive release candidates where required, declarative ordinary project test registration, qualification-time deterministic generated artifacts where safe, and protected maintenance classification. Unknown ownership/impact expands proof and never justifies omission.

---

## 12. Objectives, Budgets, Progress, and Loop Guard

Objective classes: `PRIMARY`, `SECONDARY`, `FALLBACK`, `HOUSEKEEPING`, `MAINTENANCE`, `INTEGRATION`, `REPORT_ONLY`.

Recommended product defaults: 90-minute wall-clock, one active candidate, two refreezes, two prerequisite PRs, two repeated semantic failures, two protected-main restarts, two full validations without progress, 45-minute no-progress limit, and 2.0 scope-growth ratio.

Bosun reasoning work uses tighter defaults, typically 30-minute warning and 45-minute park.

Material progress is real objective advancement. Recreating equivalent candidates, rerunning unchanged proof, rereading unchanged logs, renaming branches, or absorbing every new defect is not progress.

Failure fingerprints normalize objective family, authority mode, workflow/job/step, stable semantic error class, path/contract class, lineage, base relationship, and repair category. Counters survive new branches, PRs, chats, wording, and close/reopen cycles. Same semantic failure twice parks by default. Alternating `A-B-A-B` is also a loop.

---

## 13. Shared-Defect Ownership Rule

> **A product project may report a shared infrastructure defect. It may not adopt it unless it owns that subsystem.**

```text
Tideglass discovers Shipwright validation-runtime Git assumption
 -> BLOCKED_BY_BOSUN MW-00418
Bosun repairs Shipwright validation runtime in isolated worktree
 -> focused proof -> Sounding Line -> merge
Tideglass resumes against repaired main
```

This prevents narrow product work from absorbing unrelated Shipwright, Sounding Line, Deepwater, registry, and other infrastructure changes.

---

## 14. Candidate Lineage and Supersession

Each deliverable has one active product candidate. Successors are bounded and must record predecessor, terminal reason, diff relationship, new identity, and remaining budget. When a successor is valid, Bosun/Fairlead may close the predecessor with preserved lineage/terminal evidence. Historical PRs remain evidence, not active state.

---

## 15. Project Bosun Relationship

Project Bosun, **The Autonomous Repository Maintenance and Repair Service**, is a subordinate Nightwatch subsystem. It owns finding normalization/deduplication, risk classification, maintenance priority/queue, isolated repair worktrees, deterministic `AUTO_0`, bounded Codex `AUTO_1` and protected `AUTO_2` work, focused verification coordination, post-merge verification, dependent wakeup, receipts, and Bridgewatch telemetry.

Bosun does not own release semantics, product behavior, user-support private diagnosis, GitHub quota mechanics, or deployment operations.

One preferred controller, `nightwatchd` or equivalent, hosts Nightwatch and Bosun rather than a swarm of always-on competing daemons.

---

## 16. Bosun Automation Classes

- `AUTO_0`: deterministic housekeeping, no Codex.
- `AUTO_1`: bounded low-risk engineering repair in isolated worktree.
- `AUTO_2`: protected maintenance candidate requiring independent maintenance authority.
- `OWNER`: semantic/security/destructive/governance decision, no autonomous mutation.
- `BLOCKED`: external precondition unavailable, preserve and continue elsewhere.

Initial capacity: up to two non-overlapping `AUTO_0`; one Codex reasoning repair; one protected maintenance authority at a time. No findings means no inference burn.

---

## 17. Leases, Persistent State, and Restart Recovery

Lease classes include source write, migration range, Sounding Line policy, browser runtime, generated registry, GitHub PR lineage, and Integration Acceptance. Expired/out-of-scope mutations fail closed.

Persistent state records sessions, candidates, queue, migrations, objectives, leases, Codex/verification runs, fingerprints, budgets, findings/history, and events. A local untracked SQLite store such as `.nightwatch/nightwatch.sqlite` is acceptable. Restart reloads ledger, reconciles repository/GitHub/process/worktree truth, expires dead ownership, and resumes without resetting history.

---

## 18. Trim, Fairlead, and Bridgewatch

Project Trim supplies narrow context packets and autonomous in-scope expansion for Bosun Codex workers. The deterministic controller decides when reasoning is required.

Fairlead owns GitHub routing, caching, quota coordination, request coalescing, and degraded interaction. Bosun declares intent, not a separate polling system.

Bridgewatch exposes Product Fleet status, Integration Queue, queue-front, divergence, migration reservations/collisions, reconciliation attempts, acceptance state, and a first-class **Bosun/Bosun's Deck** station showing active objective, class/risk, blocked projects, budget, Codex state, fingerprint, lease, focused proof, successor count, automatic resolution rate, mean repair time, projects unblocked, blocking hours avoided, usage telemetry, recurring failures, owner escalation, and shared baseline health. Missing telemetry is itself source-health information.

---

## 19. Security and Prompt Safety

Nightwatch/Bosun never store credentials or private user/chat content in repository records. Codex cannot classify its own authority. Unknown risk escalates. Repairs may not weaken Sounding Line or branch protection to ease their own merge. User-support private data remains under Admiralty support governance.

"Run all night" or "do not stop" means continue useful authorized work across the plan, not continue one pathological objective indefinitely. Global/objective limits and integrity always outrank completion wording.

---

## 20. Implementation Roadmap

### Increment A: Integration Queue and Migration Reservations
Machine-readable queue, candidate lifecycle, queue-front rule, one-active-candidate enforcement, JIT reconciliation, migration allocator, Bridgewatch projection.

### Increment B: Sounding Line Maintenance Isolation
Shared baseline watch, project-owned ordinary acceptance, declarative registration, qualification-time generated artifacts, maintenance classification and protected boundaries, all implemented through Sounding Line's authority.

### Increment C: Project Bosun

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

The Product Fleet does not need to pause while these increments are implemented, except where an exact shared authority change requires a bounded integration slot.

---

## 21. Final Acceptance Criteria

Nightwatch v1.0 is accepted only when product development remains parallel; locally complete candidates persist in an Integration Queue; non-front candidates stop chasing `main`; queue front alone performs JIT reconciliation; migration allocations cannot collide; one active candidate exists per objective; shared defects transfer to canonical maintenance ownership; Bosun deterministic work can run without AI; Bosun reasoning repairs are bounded/isolated; high-risk changes escalate; Sounding Line remains sole acceptance authority; Fairlead owns GitHub mechanics; Trim supplies context; Bridgewatch shows real queue/maintenance/budget/source health; restart preserves state; founding incident replay parks the runaway lane early; and a PR `#334`-equivalent Shipwright validation defect is repaired under Bosun once and used to resume the product candidate without product-scope metastasis.

> **One break no longer stops the factory, and one finished product no longer needs to chase the factory while waiting for inspection.**

---

## 22. Default Thresholds and Example Handoff

| Metric | Warning | Default action limit |
|---|---:|---:|
| Product objective wall time | 60 min | park 90 min |
| Bosun AUTO_1 | 30 min | park 45 min |
| No material progress | 20 min | park 45 min |
| Same semantic failure | first repeat | park second equivalent |
| Product/Bosun successors | 1 | owner/park before third |
| New PRs in lineage | 3 | park 5 |
| Active product candidates/objective | N/A | reject above 1 |
| Reconciliation restarts | 1 | park after 2 |
| Full authority attempts without progress | 1 | park after 2 |
| Scope growth | 125% | park 200% or +10 files |
| Bosun reasoning concurrency | 1 | evidence required to increase |
| AUTO_0 concurrency | 2 | non-overlap proof required |
| Protected maintenance authority | 1 | do not exceed by default |

```text
PROJECT NIGHTWATCH - SHIFT HANDOFF
Starting main: <sha>
Ending main: <sha>

PRODUCT FLEET
- Admiralty P3: implementing
- Drydock P4: QUEUE_READY
- Wakebook P2: QUEUED position 2

BOSUN COMPLETE
- MW-00418: Shipwright non-Git validation runtime repaired
- MW-00421: deterministic registry drift reconciled
- 4 superseded PRs closed

OWNER REQUIRED
- MW-00423: release-authority semantic change, no mutation

INTEGRATION QUEUE
1. Drydock P4 - qualifying
2. Wakebook P2 - frozen, no repeated reconciliation
```

---

## 23. Governance and Glossary

Nightwatch cannot modify its own budget, lease, classifier, or authority semantics and use the changed behavior to qualify itself. Sounding Line, Fairlead, Trim, Bridgewatch, Breakwater, Bosun, and product-owner governance retain their boundaries.

| Term | Definition |
|---|---|
| Product Fleet | parallel feature/project development lane |
| Integration Queue | persistent serialized queue of locally complete candidates |
| Queue Front | candidate authorized for JIT reconciliation/acceptance |
| Migration Reservation | canonical allocation preventing branch collisions |
| Bosun | Nightwatch-subordinate Autonomous Repository Maintenance and Repair Service |
| Finding | normalized maintenance signal with provenance |
| Failure Fingerprint | semantic identity across surface wording/PR/SHA changes |
| Execution Lease | bounded scope/time mutation authorization |
| Shared Baseline | common infrastructure health watched independently from product candidates |
| Watch Ledger | restart-safe Nightwatch/Bosun operational state |

---

**End of Project Nightwatch Governing Document v1.0 - Revised Three-Lane Edition**
