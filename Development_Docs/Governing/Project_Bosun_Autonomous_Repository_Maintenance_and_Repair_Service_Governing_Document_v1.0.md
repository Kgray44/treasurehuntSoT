---
title: Project Bosun - Autonomous Repository Maintenance and Repair Service
audience: engineering
status: governing
canonical_for: project-bosun-v1
parent_program: Project Nightwatch
version: "1.0"
last_reviewed: 2026-08-19
repository_baseline: d7e3f2f873139e3f7353bf288124f50543ce2aac
---

# PROJECT BOSUN

## The Autonomous Repository Maintenance and Repair Service

**Nightwatch Subsystem Governing Architecture, Automation Safety, Repair Contracts, and Product Requirements Document**

**Version:** 1.0  
**Date:** August 19, 2026  
**Status:** Governing subsystem baseline
**Parent program:** Project Nightwatch  
**Repository baseline reviewed:** `Kgray44/treasurehuntSoT` at `d7e3f2f873139e3f7353bf288124f50543ce2aac`

> **Governing Principle**  
> Shared repository maintenance must happen continuously, cheaply, safely, and under the correct owner. Deterministic problems should be repaired deterministically. Reasoning should be invoked only when required. No maintenance objective may self-authorize, absorb product scope, run without bounded leases and budgets, or become a new runaway candidate lineage.

---

## 1. Executive Summary

Project Bosun is the autonomous maintenance department of Project Nightwatch. It exists because Voyagewright's feature projects can now implement faster than shared repository infrastructure can be diagnosed and repaired manually.

Before Bosun, a product candidate often discovered a shared defect during its own qualification and became the unlucky repair owner. A Tideglass candidate could suddenly absorb a Shipwright validation-runtime repair, a Sounding Line registration repair, generated P34 records, a Deepwater digest update, and browser-fixture changes. The candidate's scope grew, protected `main` advanced through supporting repairs, the original product branch became stale, and integration churn multiplied.

Bosun changes that ownership model:

```text
Product project discovers shared defect
        |
        v
Bosun finding
        |
        v
deterministic classification
        |
        +--> AUTO_0: governed mechanical repair, no Codex
        |
        +--> AUTO_1: bounded Codex engineering repair
        |
        +--> AUTO_2: bounded protected-maintenance candidate
        |
        +--> OWNER: park, no mutation
        |
        v
focused proof
        v
Sounding Line
        v
Fairlead / protected GitHub integration
        v
post-merge verification
        v
wake blocked product candidates
```

Bosun is **not an AI agent that thinks continuously about the repository**. The preferred architecture is a low-cost deterministic controller, hosted inside `nightwatchd` or an equivalent Nightwatch runtime. It watches event sources, normalizes findings, deduplicates them, classifies risk, schedules work, obtains leases, and invokes Codex only for objectives that genuinely require reasoning.

Bosun does not replace Sounding Line, Fairlead, Trim, Bridgewatch, Breakwater, Admiralty, or any product owner. It coordinates bounded repairs through those authorities.

The desired result is simple:

> **Feature chats build features. The Integration Queue integrates finished features. Bosun repairs the railway in the background.**

---

## 2. Project Identity

A bosun is responsible for keeping a vessel's working equipment, deck systems, rigging, and daily machinery in order. The name fits a subsystem whose purpose is not to command the Voyage, design the Chronicle, or decide release truth, but to make sure the engineering ship remains mechanically serviceable.

Formal identity:

- **Program:** Project Bosun
- **Subtitle:** The Autonomous Repository Maintenance and Repair Service
- **Parent:** Project Nightwatch
- **Runtime:** Bosun Engine inside `nightwatchd` or equivalent
- **Primary UI:** Bridgewatch Bosun station / Bosun's Deck
- **Primary authority boundary:** subordinate to Nightwatch orchestration and Sounding Line verification

The earlier phrase **Maintenance Watch** is retained only as a conceptual/legacy description of the background lane. Project Bosun is the formal system name.

---

## 3. Why Bosun Exists

### 3.1 Shared Maintenance Was Being Discovered Too Late

Product candidates have repeatedly reached broad authoritative acceptance with project-owned evidence green, only to expose failures in shared browser fixtures, runtime assumptions, generated registries, authority plumbing, or neighboring project tests. PR `#334` is the clearest recent example: 54 focused product tests and local qualification were green, but Wave 0 exposed many shared browser failures. One receipt specifically showed a Shipwright runner invoking Git in Sounding Line's isolated validation mirror, which intentionally had no `.git` worktree.

That defect belonged to shared validation runtime ownership, not to Tideglass product semantics.

### 3.2 Small Repairs Had Disproportionate Coordination Cost

Simple issues such as:

- deterministic generated-registry drift;
- stale route/fixture references;
- an adapter assuming a Git worktree;
- a stale policy digest;
- a superseded PR still marked active;
- an expired task root or lease;
- a central migration-number collision;

could require a new Codex chat, repository archaeology, branch creation, focused proof, Sounding Line classification, GitHub interaction, and manual follow-up from the owner.

The problem was not that the code repair was large. The **human interrupt cost** was large.

### 3.3 Idle Capacity Was Being Wasted

Parallel project chats often wait on CI, protected acceptance, or another owner. During that time, small shared defects could be repaired without stopping product implementation. The missing mechanism was a permanent maintenance queue and a deterministic controller that could exploit safe capacity.

---

## 4. Non-Negotiable Principles

1. **Bosun is subordinate to Nightwatch.** It is not a competing orchestrator.
2. **Sounding Line is the verifier.** Bosun cannot issue `RELEASE_GO` or maintenance authority.
3. **Owners retain semantics.** Bosun repairs an owning subsystem; it does not invent product behavior.
4. **Deterministic before AI.** Mechanical work must not consume Codex reasoning unnecessarily.
5. **AI on demand.** No always-thinking agent waiting for something to break.
6. **Bounded repair scope.** Every finding becomes a scoped objective with explicit allowed paths/contracts.
7. **One repair candidate per objective.** Successors are bounded and lineage-accounted.
8. **No self-authorization.** A repair that changes its own maintenance authority must use an independently trusted path.
9. **Focused proof before authority.** Sounding Line is not a debugging loop.
10. **Unknown means conservative.** Unknown owner/risk/impact cannot produce broader autonomy.
11. **Restart safety.** Active findings, leases, worktrees, and budgets survive controller restart.
12. **Product throughput wins.** Background maintenance cannot consume all scarce browsers, databases, build slots, or reasoning capacity merely because work exists.
13. **No private user support.** User-account support and scoped private-data diagnosis belong to Admiralty Support Pilot, not Bosun.
14. **No hidden GitHub bypass.** GitHub mechanics flow through Fairlead-compatible operations.

---

## 5. Canonical Ownership Matrix

| Area                           | Owner           | Bosun role                                 |
| ------------------------------ | --------------- | ------------------------------------------ |
| Maintenance scheduling         | Nightwatch      | Execute subordinate maintenance queue      |
| Test/release authority         | Sounding Line   | Produce candidates/evidence only           |
| GitHub requests and mutations  | Fairlead        | Request bounded operations                 |
| Codex context                  | Project Trim    | Consume minimum sufficient context packets |
| Mission Control                | Bridgewatch     | Publish maintenance status/telemetry       |
| Deployment/process operations  | Breakwater      | Request operational action through owner   |
| User support/private diagnosis | Admiralty       | No direct ownership                        |
| Product business semantics     | Product project | Repair only inside owner-approved contract |
| Migration allocations          | Nightwatch      | Detect/use reservations; report collisions |
| Deep audit/findings            | Deepwater       | May consume/produce maintenance findings   |

---

## 6. Preferred Runtime Architecture

Bosun should run as a subsystem of one persistent deterministic Nightwatch controller:

```text
nightwatchd
  |
  +-- plan/session manager
  +-- Integration Queue
  +-- budgets / loop guard
  +-- migration reservations
  +-- lease broker
  +-- persistent ledger
  |
  +-- bosun engine
       +-- detectors
       +-- normalizer
       +-- deduplicator
       +-- classifier
       +-- priority scheduler
       +-- AUTO_0 executor
       +-- Codex worker adapter
       +-- verification coordinator
       +-- post-merge verifier
       +-- Bridgewatch projection
```

Separate daemons may be used when deployment architecture requires them, but they must share one authoritative Nightwatch state and must not independently reinterpret maintenance policy.

Idle controller cost should be negligible. The controller observes cheap event/state inputs and only launches reasoning when an actionable `AUTO_1` or `AUTO_2` objective exists.

---

## 7. Detection Sources

Bosun is event-first and polling-second. Expected sources include:

### Sounding Line

- failed focused or authoritative receipts;
- cleanup failures;
- generated registry drift;
- shared baseline/sentinel degradation;
- stale test registration;
- validation-mirror contract failures;
- trusted policy/schema inconsistency;
- evidence invalidation tied to shared infrastructure.

### Fairlead / GitHub

- superseded PRs;
- abandoned successor lineages;
- failed protected checks;
- stale candidate metadata;
- branch cleanup opportunities;
- low quota or degraded GitHub interaction paths.

### Repository / Git

- migration reservation collision;
- generated-file drift;
- orphan worktrees;
- orphan task roots;
- stale leases;
- inconsistent generated indexes;
- policy digest drift;
- project registration mismatch.

### Bridgewatch

- source-health degradation;
- expected fact class missing;
- stale telemetry;
- repository/project status contradiction;
- shared runtime health alert.

### Integration Queue

- queue-front candidate blocked by shared infrastructure;
- multiple queued candidates blocked by same fingerprint;
- generated-state or migration prerequisite needed before qualification.

### Deepwater / Other Audit Systems

- repeated realization or ownership finding mapped to a deterministic maintenance action;
- systemic support pattern that has been promoted to an engineering defect after appropriate governance.

---

## 8. MaintenanceFinding Contract

A normalized finding should resemble:

```ts
type MaintenanceFinding = {
  findingId: string;
  fingerprint: string;
  source: "SOUNDING_LINE" | "FAIRLEAD" | "REPOSITORY" | "BRIDGEWATCH" | "INTEGRATION_QUEUE" | "DEEPWATER";
  category: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedProjects: string[];
  affectedContracts: string[];
  affectedPaths: string[];
  blocksIntegration: boolean;
  blocksProjects: string[];
  evidenceRefs: string[];
  detectedAt: string;
};
```

The exact implementation language is not normative. Stable identity, source provenance, affected ownership, blocking impact, and evidence are normative.

No finding becomes mutation authority merely because it exists.

---

## 9. Normalization and Deduplication

Bosun must collapse equivalent findings across changing wrappers, PR numbers, SHAs, and error text.

A fingerprint should use stable semantic fields such as:

- canonical owning subsystem;
- failure category;
- failing contract/suite/resource;
- relevant error code/class;
- runtime class;
- repair class;
- affected shared surface.

Example:

```text
owner=shipwright-validation
category=isolated-runtime-assumption
resource=git-worktree
contract=shipwright-governed-runner
```

This remains the same finding if a later browser receipt uses different wording.

Duplicate findings increment occurrence counters and blocked-candidate sets rather than creating parallel repair objectives.

---

## 10. Classification Model

Protected Nightwatch/Bosun policy classifies every objective as one of:

### `AUTO_0` - Deterministic Housekeeping

No reasoning required.

Examples:

- regenerate deterministic active test registry;
- regenerate documentation index;
- refresh generated Feature Catalog projection;
- verify generator idempotence;
- clean expired known task-owned runtime roots;
- release stale lease after authoritative ownership check;
- close clearly superseded PR through Fairlead;
- reconcile deterministic source digest.

### `AUTO_1` - Bounded Low-Risk Engineering Repair

Codex may implement inside a narrow owner scope.

Examples:

- fixture references renamed route/control;
- governed runner assumes `.git` where sealed runtime intentionally does not have Git metadata;
- stale browser assertion against current canonical behavior;
- task-owned cleanup failure;
- ordinary adapter defect;
- project-owned test registration correction within already-approved declarative schema.

### `AUTO_2` - Protected Maintenance

Codex may implement, but separate protected maintenance authority is mandatory.

Examples:

- narrow Sounding Line worker/resource policy repair;
- trusted registration boundary;
- authority-maintenance allowlist change;
- maintenance protected-binding correction;
- shared validation-runtime policy change.

### `OWNER` - Explicit Owner Decision

No autonomous mutation.

Examples:

- changing `RELEASE_GO` semantics;
- weakening mandatory evidence;
- changing security authorization;
- widening privileged access;
- destructive schema repair;
- broad governance reinterpretation;
- production data mutation outside a pre-governed repair command;
- any change whose legitimate risk cannot be proven within AUTO policy.

### `BLOCKED`

External credential/provider/precondition unavailable or no safe current path.

Bosun checkpoints and moves to another objective.

---

## 11. Risk Classification

A classification decision must consider:

- owner scope;
- changed paths/contracts;
- user-data impact;
- schema/migration impact;
- security/authorization impact;
- release-authority impact;
- public/private boundary;
- reversibility;
- idempotency;
- maximum affected records/resources;
- whether the repair can weaken the mechanism validating itself.

Unknown risk escalates. It never defaults to `AUTO_1`.

Codex cannot promote its own repair class.

---

## 12. Maintenance Priority

Bosun is not simple FIFO.

Recommended classes:

| Priority | Meaning                                                    |
| -------- | ---------------------------------------------------------- |
| P0       | blocks protected integration or shared safety              |
| P1       | shared infrastructure affecting multiple active projects   |
| P2       | Sounding Line, Fairlead, migration, generated-state health |
| P3       | project-local maintenance not currently blocking fleet     |
| P4       | deterministic hygiene and cleanup                          |

Priority score may include:

- number of blocked candidates;
- queue-front impact;
- age;
- severity;
- repair risk;
- expected repair cost;
- recurrence count;
- whether defect is already known/fingerprinted;
- owner urgency.

A one-minute registry drift should not outrank a failure blocking six completed candidates merely because it was detected first.

---

## 13. Capacity and Concurrency

Initial defaults:

```text
AUTO_0 deterministic jobs:       up to 2 concurrent
AUTO_1/AUTO_2 Codex reasoning:   1 concurrent
protected maintenance authority: 1 concurrent
```

Product work keeps priority over scarce local resources unless the maintenance objective blocks product throughput or repository integrity.

Bosun may borrow idle capacity, but it must release that capacity when higher-priority product or integration work needs it.

If there are no findings, Codex usage is zero.

---

## 14. Lease Model

Before mutation, Bosun obtains a lease.

Lease types include:

- `SOURCE_WRITE`
- `MIGRATION_RANGE`
- `SOUNDING_LINE_POLICY`
- `BROWSER_RUNTIME`
- `GENERATED_REGISTRY`
- `GITHUB_PR_LINEAGE`
- `WORKTREE`
- `INTEGRATION_ACCEPTANCE`

Lease fields include objective ID, owner, allowed paths/contracts, issued/expiry time, mutation budget, candidate budget, and authority class.

Overlapping mutable leases are rejected unless explicitly modeled as safe.

Lease expiration stops mutation and transitions the objective into safe recovery. It does not silently renew itself.

---

## 15. Isolated Maintenance Worktrees

Every Codex `AUTO_1`/`AUTO_2` repair receives a dedicated task-owned worktree based on current protected `main` or the exact owner-approved base.

Conceptually:

```text
maintenance-worktrees/
  mw-00417/
  mw-00418/
```

A maintenance worker must not edit active product worktrees.

It records:

- base SHA/tree;
- branch;
- worktree path;
- allowed paths;
- lease;
- Codex run/thread;
- budget;
- finding fingerprint;
- validation evidence;
- cleanup state.

When complete, worktree cleanup is governed and receipt-backed.

---

## 16. `AUTO_0` Deterministic Executor

Bosun should contain a registry of approved deterministic maintenance actions.

Each action declares:

- action ID/version;
- owner subsystem;
- allowed paths/resources;
- inputs;
- deterministic output identity;
- idempotency rule;
- preconditions;
- verification command;
- rollback/cleanup behavior;
- maximum scope;
- whether a PR is required.

A deterministic script that produces an unexpected diff broadens or fails closed. It does not silently commit extra files.

Examples:

```text
registry.regenerate
index.regenerate
generated-catalog.refresh
lease.release-expired
worktree.cleanup-expired
pr.close-superseded
```

Do not spend tens of thousands of tokens asking Codex to run an idempotent generator and compare its digest.

---

## 17. Codex Maintenance Worker

When reasoning is needed, the controller launches a bounded Codex task, initially through a supported noninteractive execution adapter or a future resumable SDK adapter.

The worker receives:

- objective identity;
- execution profile, normally `UNATTENDED_CONTINUATION` within the bounded repair scope;
- finding/fingerprint;
- owner subsystem;
- evidence refs;
- exact allowed paths/contracts;
- explicit forbidden scope;
- success postconditions;
- budget;
- requirement not to self-dispatch final authority unless the governed workflow specifically assigns it.

Example task contract:

```text
MAINTENANCE OBJECTIVE MW-00418

Class: AUTO_1
Owner: Shipwright validation runtime
Problem:
  scripts/shipwright/run-phase2-journeys.mjs assumes Git metadata exists in
  an isolated Sounding Line validation mirror where .git is intentionally absent.

Allowed:
  scripts/shipwright/**
  directly affected tests
  deterministic registration output only when required

Forbidden:
  Shipwright product behavior
  unrelated projects
  Sounding Line release semantics
  branch-protection changes

Success:
  reproduce focused failure
  repair root cause
  relevant focused tests pass
  isolated-runtime contract passes
  coherent candidate created
```

Project Trim supplies minimum sufficient context and autonomous targeted context expansion. Bosun does not ask the user merely because another relevant repository file must be read.

---

## 18. Work Continuity and Stop Conditions

Bosun must continue independent safe objectives when one finding is waiting on external state.

Ordinary setup/diagnostic conditions are not hard stops:

- missing task-owned dependencies;
- needing `npm ci` according to repository policy;
- task-local environment configuration;
- focused failing test;
- occupied port when a safe task-owned port exists;
- need to inspect another relevant governing/source file;
- generated file needing regeneration.

Hard stops include:

- owner-required class;
- destructive action not authorized;
- unavailable required credentials/provider with no safe simulation path;
- integrity uncertainty;
- conflict with unrelated owner work;
- no safe in-scope continuation.

A hard stop parks the objective. It does not stop Bosun's entire queue when other work exists.

---

## 19. Sounding Line Handoff

Bosun can reach `REPAIR_CANDIDATE_QUALIFIED`, never `RELEASE_GO` by itself.

Expected flow:

```text
focused reproducer
 -> root repair
 -> same focused proof
 -> affected subsystem proof
 -> candidate freeze
 -> Sounding Line classification
 -> ordinary or maintenance authority
 -> protected binding/merge
```

A failed authoritative run returns the maintenance objective to focused development. Repeated full authority executions are prohibited as a debugging strategy.

`AUTO_2` changes must use independently trusted maintenance authority and anti-self-authorization rules.

---

## 20. Fairlead Handoff

Bosun should not directly poll GitHub excessively or invent its own rate-limit logic.

Fairlead-compatible actions include:

- opening/updating a repair PR;
- fetching current check state;
- closing a verified superseded PR;
- updating lineage metadata;
- observing rate limits;
- using cache/ETag/GraphQL/Git/git transport appropriately.

Fairlead decides the least expensive correct authoritative mechanism.

If a GitHub quota pool is unavailable, Bosun may continue independent local work and use cached/local truth where valid. It must not treat stale cache as fresh authority.

---

## 21. Shared Baseline Watch

Bosun consumes Sounding Line-managed shared baseline families and turns degradation into explicit maintenance objectives.

Representative families:

```text
browser.shared-shell
browser.auth-sentinel
browser.navigation-sentinel
browser.shared-fixtures
browser.accessibility-foundation
browser.runtime-environment
validation-mirror-contract
registry-determinism
```

These should run when semantically invalidated or under an appropriate health cadence, not through constant brute-force full matrices.

If a baseline fails:

```text
SHARED_BASELINE_DEGRADED
 -> finding
 -> owner classification
 -> repair objective
```

A product candidate may be blocked by the finding without inheriting the repair diff.

---

## 22. Migration Reservation Interaction

Bosun does not allocate migration ranges independently from Nightwatch's canonical reservation manager.

Bosun can:

- detect duplicate/overlapping reservations;
- verify a branch used its assigned range;
- release expired unused reservations according to policy;
- repair deterministic ledger drift;
- flag historical branches that still carry collided migration IDs.

A repair requiring renumbering a completed product candidate is normally an Integration Queue or product-owner action unless policy explicitly authorizes Bosun to perform the mechanical renumbering at queue front.

---

## 23. Generated Artifact Maintenance

Generated artifacts may include active test registry, document index, generated Feature Catalog views, source-bound digests, migration inventories, and other deterministic evidence.

Bosun should prefer:

```text
generator identity
+ input tree/contract identity
+ deterministic output digest
```

over long-lived stale branch-owned copies when repository architecture permits qualification-time generation.

A generated artifact must never be hand-edited merely to satisfy policy.

If current governance requires the output committed, Bosun may generate and verify it through a bounded `AUTO_0` objective.

---

## 24. Declarative Test Registration and Policy Drift

Bosun may correct ordinary project-owned test-registration drift only when Sounding Line provides a protected declarative registration contract that proves:

- source/test ownership;
- approved schema;
- resource declaration;
- risk class;
- no authority code change;
- no global ownership theft.

Changes to finalizer, `RELEASE_GO`, authority-maintenance policy, protected workflow semantics, or another project's test ownership are not ordinary registration. They classify as `AUTO_2` or `OWNER` according to protected policy.

---

## 25. Pull Request Supersession

A maintenance objective may close superseded PRs automatically only when lineage is provable.

Required evidence:

- predecessor/successor relationship;
- surviving intended scope accounted for;
- successor branch/PR exists;
- predecessor is not independently required;
- no owner hold label/state prevents closure.

Closure comment should record successor, retained scope, and terminal reason.

There should be one active candidate per objective. Historical PRs remain queryable evidence, not active work.

---

## 26. Post-Merge Verification and Dependent Wakeup

After a maintenance merge, Bosun must not immediately declare every blocked candidate repaired.

Post-merge sequence:

1. verify exact protected-main landed identity;
2. rerun or inspect the smallest shared baseline contract proving the defect is gone;
3. close the finding only when postconditions pass;
4. update blocked candidates;
5. notify Nightwatch Integration Queue that affected candidates are eligible to re-enter/resume qualification;
6. preserve the maintenance receipt and lineage.

This prevents a repair PR from becoming a ritual rather than evidence.

---

## 27. Persistent State

A local durable store may be SQLite, conceptually `.nightwatch/nightwatch.sqlite`, with tables such as:

```text
findings
objectives
leases
codex_runs
verification_runs
candidate_lineage
budgets
events
integration_queue
maintenance_history
```

Secrets and private user data are forbidden.

On restart, Bosun reconciles each `ACTIVE` objective against process/worktree/GitHub truth and resumes only from a valid state. Dead processes are not assumed alive; absent processes are not treated as successful.

---

## 28. Bosun Objective State Machine

```text
DETECTED
 -> NORMALIZED
 -> DEDUPLICATED
 -> CLASSIFIED
 -> QUEUED
 -> LEASED
 -> DIAGNOSING
 -> REPAIRING
 -> FOCUSED_VERIFICATION
 -> CANDIDATE_READY
 -> SOUNDING_LINE
 -> INTEGRATING
 -> POST_MERGE_VERIFY
 -> RESOLVED
```

Controlled exits:

```text
PARKED_OWNER
PARKED_BUDGET
FAILED_BOUNDED
BLOCKED_EXTERNAL
SUPERSEDED
DUPLICATE
CANCELLED_INTEGRITY
```

No transition may skip directly from repair implementation to `RESOLVED` without verification/postconditions.

---

## 29. Budgets and Loop Protection

Recommended `AUTO_1` defaults:

```json
{
  "wallClockLimitMinutes": 45,
  "warningMinutes": 30,
  "maxActiveCandidates": 1,
  "maxCandidateSuccessors": 2,
  "maxRepeatedFailureSignatures": 2,
  "maxAuthorityAttemptsWithoutProgress": 2,
  "noMaterialProgressMinutes": 20,
  "scopeGrowthRatio": 1.5
}
```

Maintenance scope should normally be much narrower than product scope. Unexpected broad growth is a classification signal, not an invitation to continue.

A repair that reaches the same semantic failure twice parks.

Bosun is explicitly forbidden from becoming PR `#334` with a wrench.

---

## 30. Security Threat Model

Bosun must defend against:

- self-authorizing policy changes;
- forged or stale findings;
- path-scope escape;
- poisoned generated artifacts;
- malicious or accidental worktree overlap;
- unsafe cleanup deleting owner data;
- stale GitHub state causing incorrect PR closure;
- migration reservation theft;
- repair candidate widening product scope;
- credentials in task logs;
- private content copied into a public repair branch;
- uncontrolled paid usage;
- runaway recursive repair generation;
- compromised/replayed maintenance receipts.

Controls include protected classifier policy, least privilege, signed/digested ledger state where practical, exact owner/path leases, immutable evidence refs, Sounding Line final authority, Fairlead quota-aware GitHub access, and Bridgewatch operator visibility.

---

## 31. Privacy Boundary

Bosun is repository maintenance, not user support.

It may inspect:

- source code;
- test evidence;
- generated project records;
- synthetic fixtures;
- build/runtime logs within repository privacy rules;
- Bridgewatch operational telemetry.

It may not independently inspect:

- private Chronicle content;
- private user media;
- credentials;
- user support case data;
- live personal records.

Those require the owning system and, for user support, Admiralty's explicit scoped support-grant architecture.

---

## 32. Bridgewatch Bosun Station

Bridgewatch should render Bosun as a first-class Mission Control station.

For each active objective show:

```text
MW-00418
Shared Shipwright validation runtime
Class: AUTO_1
Priority: P0
State: FOCUSED_VERIFICATION
Blocks: Tideglass P4, Shipwright P3
Elapsed: 7m 18s
Budget: 18m / 45m
Codex: ACTIVE
Unique failures: 1
Candidate successors: 0
Lease: SOURCE_WRITE scripts/shipwright/**
```

Aggregate metrics:

- findings detected today;
- AUTO_0/1/2/OWNER counts;
- automatic resolution percentage;
- mean and p95 repair time;
- projects/candidates unblocked;
- estimated blocking hours avoided;
- Codex usage/credits when available;
- recurring fingerprints;
- owner escalations;
- shared baseline health;
- maintenance queue depth/age;
- failed/parked objectives.

Bosun source health must itself be monitored. A dead maintenance controller cannot be displayed as "nothing to repair."

---

## 33. Alerts and Owner Escalation

Alert immediately for:

- `OWNER` objective blocking queue front;
- repository-integrity risk;
- security boundary violation;
- repeated same-fingerprint repair failure;
- maintenance candidate scope escaping lease;
- migration collision affecting multiple active candidates;
- Bosun controller unavailable while P0 findings exist;
- unauthorized paid-overage threshold approaching/entered.

Routine `AUTO_0` success should normally be summarized, not spam the owner.

Owner absence is not permission to execute `OWNER` class work. Bosun parks and continues elsewhere.

---

## 34. Failure and Fallback Behavior

| Failure                      | Required behavior                                                      |
| ---------------------------- | ---------------------------------------------------------------------- |
| GitHub quota low             | Fairlead degraded path, local work continues where safe                |
| Codex unavailable            | AUTO_0 continues; reasoning jobs remain queued                         |
| Sounding Line busy           | repair candidate waits; other maintenance continues                    |
| Shared browser resource busy | use lease/queue; do not steal product resource                         |
| Finding source unavailable   | mark source unhealthy; do not fabricate state                          |
| Worktree disappears          | reconcile ledger, mark interrupted, recreate only from safe base       |
| Same repair failure repeats  | park objective                                                         |
| Scope grows unexpectedly     | reclassify/park                                                        |
| Controller restarts          | recover from durable ledger                                            |
| Main advances                | maintenance objective re-evaluates exact semantic impact within budget |
| Owner decision required      | no mutation, continue other queue items                                |

---

## 35. Testing and Acceptance Matrix

Bosun must prove at least:

- finding normalization from every supported source;
- semantic deduplication across different error wording;
- AUTO classification cannot be elevated by Codex;
- unknown risk fails closed;
- lease overlap prevents concurrent mutation;
- expired lease prevents write;
- AUTO_0 idempotence;
- deterministic generator unexpected diff fails;
- isolated worktree never mutates product worktree;
- Product Trim packet is narrow and expansion remains in-scope;
- Codex repair budget parks correctly;
- Sounding Line remains sole final authority;
- AUTO_2 cannot self-authorize;
- Fairlead interaction respects degraded GitHub state;
- superseded PR closure requires complete lineage;
- post-merge verification required before finding resolution;
- restart recovery preserves budgets and objectives;
- private user data cannot enter maintenance ledger;
- Bridgewatch projection matches ledger;
- PR `#334`-style shared Shipwright validation defect is extracted from the product candidate, repaired once, and allows product qualification to resume.

---

## 36. Implementation Phases

Bosun should be implemented only after/with the Nightwatch and Sounding Line prerequisites required by the three-lane model.

### B0 - Rig the Workbench

- define finding/classifier schemas;
- add durable storage;
- add Bosun projection contract;
- implement read-only detectors in shadow mode;
- prove no mutations occur.

### B1 - Scrub the Deck

- enable `AUTO_0` deterministic registry;
- add idempotence/diff guards;
- add task-root/lease cleanup;
- add verified PR supersession where Fairlead allows;
- Bridgewatch displays deterministic jobs.

### B2 - Send the Repair Party

- add isolated maintenance worktrees;
- add Codex execution adapter;
- integrate Project Trim packets;
- implement AUTO_1 budgets, leases, focused development verification;
- stop before final authority.

### B3 - Work the Protected Gear

- enable AUTO_2 candidate creation under trusted policy;
- integrate Sounding Line maintenance classifier/authority;
- prove anti-self-authorization;
- integrate Fairlead mutation handling.

### B4 - Stand the Bosun's Watch

- enable event-first continuous operation;
- post-merge verification and dependent wakeup;
- restart recovery;
- Bridgewatch full station and history;
- supervised daytime soak;
- supervised unattended soak;
- final security/loop/throughput acceptance.

Each phase must leave the repository coherent if later phases never happen.

---

## 37. Final Acceptance Criteria

Bosun v1.0 is complete only when:

1. no continuous Codex process is required to discover that nothing is wrong;
2. deterministic maintenance executes without AI where appropriate;
3. bounded reasoning repairs launch only from classified findings;
4. every repair has exact owner/scope/lease/budget;
5. one shared defect cannot silently expand a product candidate's scope;
6. duplicate findings do not create duplicate repair candidates;
7. AUTO_1/AUTO_2 loops park within configured budgets;
8. OWNER-class work performs no autonomous mutation;
9. Sounding Line independently accepts every merged repair;
10. Fairlead owns quota-aware GitHub mechanics;
11. Project Trim supplies minimum sufficient Codex context;
12. restart preserves exact objective/lease/budget state;
13. post-merge verification proves the original condition is false before resolution;
14. Integration Queue candidates blocked by a repaired defect are woken without repeatedly rebasing unrelated candidates;
15. Bridgewatch displays real maintenance state, risk, blocked projects, budget, evidence, and source health;
16. shared baseline degradation can be detected before an unrelated product candidate reaches authoritative acceptance;
17. migration/registry/generated-state/PR-lineage maintenance are measurably cheaper in owner attention than the prior manual workflow;
18. a PR `#334` counterfactual demonstrates that the Shipwright validation-runtime defect is transferred to Bosun rather than absorbed into Tideglass product scope.

The governing success condition is:

> **The repository repairs small shared problems while the feature fleet keeps moving, without granting a maintenance robot authority over the ship.**

---

## 38. Example Bosun Receipt

```json
{
  "schemaVersion": "1.0.0",
  "objectiveId": "MW-00418",
  "finding": "shipwright-governed-runtime-git-assumption",
  "class": "AUTO_1",
  "owner": "shipwright-validation-runtime",
  "priority": "P0",
  "blockedCandidates": ["tideglass-p4"],
  "allowedPaths": ["scripts/shipwright/**", "tests/shipwright/**"],
  "baseSha": "<sha>",
  "candidateSha": "<sha>",
  "focusedEvidence": ["<receipt>"],
  "soundingLineDecision": "RELEASE_GO",
  "landedMainSha": "<sha>",
  "postMergePostconditions": [
    "governed runner uses sealed candidate identity in non-git mirror",
    "isolated runtime test passes"
  ],
  "result": "RESOLVED",
  "privateUserDataAccessed": false
}
```

---

## 39. Example Normal Day

```text
09:00 Product fleet continues in parallel.
09:12 Bosun detects active-registry drift -> AUTO_0 -> fixed/verified.
09:38 WebKit shared sentinel reports a stale fixture -> AUTO_1 -> isolated repair.
09:41 Admiralty and Wakebook continue implementation uninterrupted.
10:05 Drydock requests migration range -> Nightwatch allocator reserves it atomically.
10:22 Bosun repair focused proof passes -> Sounding Line -> protected merge.
10:23 Tideglass candidate blocked by the shared fixture is marked eligible to resume.
10:40 PR #347 supersedes #342 -> Bosun/Fairlead closes #342 with lineage receipt.
11:00 Wakebook becomes QUEUE_READY; it freezes and waits rather than rebasing.
11:18 Queue-front candidate performs one JIT reconciliation and enters Sounding Line.
```

The desired outcome is not a repository where nothing breaks. It is a repository where small breaks stop consuming the owner's attention and stop infecting unrelated product work.

---

## 40. Governance and Change Control

Project Bosun is subordinate to Project Nightwatch. Nightwatch owns scheduling, budget, queue, migration reservation, and lease semantics. Sounding Line owns evidence and acceptance. Product owners own business semantics.

Bosun cannot modify its classifier, risk ceiling, or authority rules and use the modified rules to qualify that same change. Changes to AUTO classes require protected governance, negative tests, and owner review appropriate to the risk.

Maintenance history is append-only in meaning. Incidents and failed objectives may not be rewritten to make automation appear more successful.

---

## 41. Glossary

| Term             | Meaning                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Bosun            | Autonomous Repository Maintenance and Repair Service                                            |
| Finding          | Normalized maintenance signal with provenance                                                   |
| Fingerprint      | Semantic identity used to dedupe/repeat-detect findings                                         |
| AUTO_0           | Deterministic maintenance, no Codex reasoning                                                   |
| AUTO_1           | Bounded low-risk reasoning repair                                                               |
| AUTO_2           | Protected maintenance candidate requiring independent authority                                 |
| OWNER            | Explicit owner decision required, no autonomous mutation                                        |
| Lease            | Bounded scope/time authorization for repair mutation                                            |
| Repair Candidate | One bounded branch/PR implementing a maintenance objective                                      |
| Postcondition    | Explicit fact that must be true after repair                                                    |
| Shared Baseline  | Common runtime/browser/infrastructure contract maintained independently from product candidates |
| Bosun Station    | Bridgewatch Mission Control view of maintenance work                                            |
| `nightwatchd`    | Preferred deterministic controller hosting Nightwatch and Bosun engines                         |

---

**End of Project Bosun Governing Document v1.0**
