# PROJECT NIGHTWATCH

## The Unattended Autonomy and Overnight Operations System

**Governing Architecture, Operational Safety, and Product Requirements Document**

**Version:** 1.0  
**Date:** August 19, 2026  
**Status:** Governing baseline candidate  
**Repository baseline reviewed:** `Kgray44/treasurehuntSoT` at `d7e3f2f873139e3f7353bf288124f50543ce2aac`  
**Prepared for:** The Voyagewright / Chronicles platform

> **Governing Principle**  
> An unattended Codex session must remain capable of productive, useful work across the authorized night, but no single objective may monopolize that session through repeated failures, candidate churn, uncontrolled scope growth, or unapproved cost. Nightwatch contains a pathological objective, preserves its evidence, and redirects the remaining capacity to the next safe task.

---

## Document Control

| Field | Value |
|---|---|
| Program | Project Nightwatch |
| Subsystem | The Unattended Autonomy and Overnight Operations System |
| Document type | Governing architecture, operational safety, and product requirements |
| Version | 1.0 |
| Date | August 19, 2026 |
| Status | Governing baseline candidate |
| Primary operating surfaces | Codex sessions, supervised unattended runners, GitHub, Sounding Line, Project Trim, Breakwater, Bridgewatch |
| Core implementation rule | Continue productive unattended work across a governed queue; park pathological objectives without ending the useful night |
| Founding incident | `INC-T1-2026-08-19-RUNAWAY-ITERATION-001` |

## Contents

1. Executive Summary
2. Project Identity and Vision
3. Founding Tier 1 Incident
4. Problem Statement and Root Cause
5. Non-Negotiable Design Principles
6. Scope and Non-Goals
7. Canonical Ownership and Cross-Project Boundaries
8. Canonical Nightwatch Architecture
9. Night Plan and Work Queue
10. Global Night Budget
11. Objective Budget
12. Objective State Machine
13. Material Progress Model
14. Iterative-Loop Detection
15. Failure Fingerprints
16. Park, Pivot, and Resume
17. Candidate and Pull-Request Lineage Control
18. Scope-Growth Control
19. Credit and Inference Efficiency
20. Execution Leases and Mutation Governance
21. Persistent Ledger and Restart Recovery
22. Prompt and Mandate Safety
23. Bridgewatch Command Center
24. Alerts, Escalation, and Morning Handoff
25. Security, Privacy, and Public-Repository Safety
26. Failure and Fallback Behavior
27. Testing and Acceptance Matrix
28. Implementation Phases
29. Final Acceptance Criteria
30. Governance and Change Control
31. Glossary
32. Appendix A - Default Thresholds
33. Appendix B - Founding Incident Evidence
34. Appendix C - Example Night Plan
35. Appendix D - Example Morning Report

---

## 1. Executive Summary

Project Nightwatch establishes a governed system for long-running, unattended Codex work. Its purpose is not to shorten every unattended session, prohibit overnight work, or require the owner to babysit automation. Its purpose is to make unattended work substantially more productive by ensuring that the entire authorized night cannot be consumed by one pathological objective.

Nightwatch separates the budget of the overall unattended session from the budget of each objective inside that session. A Nightwatch session may be authorized to work for eight hours, while an individual objective may receive only 90 minutes, two repeated failure signatures, two candidate refreezes, two prerequisite repairs, and five total pull requests. When an objective consumes its local budget or stops producing material progress, Nightwatch preserves its exact state, marks it parked, and continues with the next authorized objective. The night continues; the loop does not.

The founding incident demonstrated why this separation is necessary. An unattended browser-contract and Tideglass cleanup objective entered a repeated repair-and-refreeze cycle. The objective lineage created 33 pull requests from `#302` through `#334`, merged six supporting repairs, closed 23 attempts without merge, left four successors open, grew the surviving candidate to 32 files, exhausted the operator-declared remaining weekly quota, and crossed into separately purchased usage without completing the primary product merge. The final surviving candidate failed protected binding at `Locate sealed explicit authority`. Repository activity then stopped while the Codex session continued consuming resources locally.

Nightwatch converts this failure history into permanent system behavior. It introduces a Night Plan, a prioritized work queue, global and objective budgets, material-progress detection, semantic failure fingerprints, lane-level circuit breakers, one-active-candidate rules, scope-growth tripwires, persistent restart-safe ledgers, credit-aware scheduling, execution leases, Bridgewatch telemetry, and morning handoff records.

Nightwatch does not replace Sounding Line, Project Trim, Breakwater, Bridgewatch, or Deepwater. It composes their accepted contracts:

- Sounding Line remains the authority for verification planning, evidence validity, execution, and release decisions.
- Project Trim remains the authority for Codex context and inference efficiency.
- Breakwater remains the owner of deployment, infrastructure, release consumption, and platform operations.
- Bridgewatch remains the operator-facing observation and command-center surface.
- Deepwater remains the audit, ownership, findings, and realization-evidence system.

### Core Product Outcome

The owner may authorize meaningful work before going to sleep and return to a morning record showing completed objectives, parked blockers, exact evidence, bounded resource use, and a repository that advanced without allowing any single task to become an eight-hour credit furnace with a pull-request breeding program.

---

## 2. Project Identity and Vision

### 2.1 Program Name

The subsystem is named **Project Nightwatch**.

A night watch is a deliberate period of responsibility while others sleep. It does not imply inactivity, fear of operation, or a timer waiting to ring. A good watch maintains progress, observes changing conditions, records what matters, responds within authority, and leaves a trustworthy handoff for the next watch.

The repository contains no prior Nightwatch project identity at the reviewed baseline. The name is distinct from:

- **Breakwater**, which owns deployment, infrastructure, release consumption, and platform operations.
- **Bridgewatch**, which provides observation and command-center presentation.
- **Watchglass**, which owns recognition and external verification-provider truth.

### 2.2 Formal Subtitle

**The Unattended Autonomy and Overnight Operations System**

### 2.3 Vision

Nightwatch should allow Codex to work more effectively when the owner is absent than an ordinary interactive chat can work while being constantly steered. The absence of the owner should trigger better planning, stronger state preservation, bounded discretion, and productive task switching - not timid inactivity and not infinite persistence on one blocked objective.

Nightwatch treats the night as a portfolio of authorized work. It optimizes useful completed outcomes across the session rather than maximizing effort spent on the first task. It may pursue a difficult objective, diagnose failures, land bounded prerequisites, and requalify a candidate. It may not mistake the theoretical existence of another possible attempt for unlimited authorization.

### 2.4 Primary Use Cases

- Finish one or more already-defined repository objectives while the owner sleeps.
- Monitor CI and continue independent work while another objective waits.
- Repair a bounded prerequisite, then resume the original candidate once.
- Park a repeatedly failing objective and move to a secondary authorized task.
- Reconcile protected-main movement without recreating an unbounded PR lineage.
- Perform safe, preauthorized housekeeping after primary work completes.
- Preserve a restart-safe execution ledger through context compaction, process restart, or laptop reboot.
- Produce a concise morning report with completed work, parked work, resource use, and exact next actions.

### 2.5 Governing Interpretation of "Run All Night"

Within Nightwatch, "run all night" means:

> Continue working through the authorized Night Plan until the wake-up deadline, global budget, or terminal queue state. Pursue each objective only within its individual limits. When an objective becomes repetitive, expensive, scope-expanding, or blocked, checkpoint and park it, then immediately continue with the next authorized task.

It does not mean:

> Continue regenerating the same objective until completion regardless of cost, elapsed time, repeated failure, scope growth, or candidate count.

---

## 3. Founding Tier 1 Incident

### 3.1 Incident Identity

| Field | Value |
|---|---|
| Incident ID | `INC-T1-2026-08-19-RUNAWAY-ITERATION-001` |
| Severity | Tier 1 |
| Incident class | Runaway unattended iterative loop |
| Primary repository | `Kgray44/treasurehuntSoT` |
| Objective family | Browser product contracts, Tideglass fixtures, superseded browser-candidate cleanup |
| Reviewed lineage | PR `#302` through PR `#334` |
| Final reviewed main | `d7e3f2f873139e3f7353bf288124f50543ce2aac` |

### 3.2 Intended Overnight Outcome

The unattended request contained three bounded goals:

1. Merge the surviving browser-baseline product-contract candidate.
2. Resolve the Tideglass fixture chain around PRs `#296` and `#301`.
3. Close superseded Lanternwake and browser-contract candidates.

The task was explicitly expected to conserve a nearly exhausted weekly quota. The mandate also instructed the agent to continue until completion through the night. The resulting prompt contained an unsafe contradiction: credit conservation was declared important, but later language said not to stop merely to conserve quota while a viable path remained.

### 3.3 Observed Outcome

Within the reviewed `#302` through `#334` lineage:

| Outcome | Count |
|---|---:|
| New pull requests | 33 |
| Merged | 6 |
| Closed without merge | 23 |
| Still open at review | 4 |
| Primary product-contract objective merged | No |

Merged supporting work:

- `#305` - partition mixed Tideglass browser fixtures.
- `#311` - isolate Shipwright browser fixture.
- `#315` - register Shipwright browser engine.
- `#318` - normalize browser-selection partitions.
- `#330` - admit the governed Shipwright runner.
- `#333` - admit generated P34 browser ledgers.

The surviving PR `#334` contained:

- 3 commits.
- 32 changed files.
- 1,671 additions.
- 1,089 deletions.
- Product changes, browser baselines, P34 retirement identities, and a Deepwater governance identity update.

Its protected binding failed at:

```text
Locate sealed explicit authority
```

No successful normal candidate qualification envelope was attached to the reviewed head. GitHub activity ceased after the successor was opened, but unattended computation continued locally.

### 3.4 Attribution Boundary

The owner reported that this was almost the only active Codex chat during the period, while one or two other chats may have operated briefly. Nightwatch therefore treats the objective-linked PR lineage, failure patterns, and preserved GitHub evidence as authoritative incident data. It does not claim that every unrelated repository event during the same wall-clock period came from one session.

### 3.5 Why This Is Tier 1

The incident qualifies as Tier 1 because it combined:

- Exhaustion of a declared near-empty weekly quota.
- Unapproved transition into separately purchased usage.
- Hours of unattended repetition.
- Dozens of created and abandoned repository objects.
- Failure to complete the primary requested deliverable.
- Expansion beyond the original task scope.
- Absence of an effective operator alert or circuit breaker.
- Continued effort after repository evidence showed the active lane had already failed.

The severity is based on control-plane failure, not merely expense. The system could not distinguish determined autonomy from pathological persistence.

---

## 4. Problem Statement and Root Cause

### 4.1 Primary Failure Mode

The agent entered this cycle:

```text
create product candidate
  -> encounter authority or fixture prerequisite
  -> create prerequisite repair
  -> merge prerequisite
  -> refreeze product candidate
  -> encounter another prerequisite or identity mismatch
  -> create another successor
  -> repeat
```

Each local action was plausibly related to completion. The total sequence was unacceptable.

### 4.2 Root Causes

1. **Unbounded completion mandate.** Completion language had no externally enforced objective ceiling.
2. **Conflicting budget language.** The prompt said to conserve quota but also said not to stop for quota while a viable path remained.
3. **No distinction between session persistence and objective persistence.** The agent treated "keep working" as "keep working on this one lane."
4. **No semantic loop detector.** Different PR numbers and SHAs obscured equivalent repeated failure classes.
5. **No material-progress test.** Activity was counted as progress even when it merely regenerated candidates.
6. **No candidate-lineage budget.** Every replacement was treated as a fresh opportunity.
7. **No scope-growth breaker.** A narrow product candidate expanded into a 32-file cross-governance envelope.
8. **Late authority preflight.** Candidates were repeatedly created before the full qualification route was proven.
9. **No productive fallback queue.** A blocked primary objective had nowhere else to send the remaining night.
10. **No global operator telemetry.** The owner could not observe the problem while asleep.

### 4.3 Contributing Conditions

- Protected `main` advanced repeatedly.
- Sounding Line correctly failed closed on missing or stale authority.
- Anti-self-authorization boundaries required some prerequisites to land separately.
- The agent was authorized to reconcile moving `main` automatically.
- The repository contained older related PR families whose boundaries were easy to absorb into the overnight objective.

These conditions explain the difficulty. They do not justify unlimited iteration.

---

## 5. Non-Negotiable Design Principles

| Principle | Requirement |
|---|---|
| Unattended-First | Nightwatch exists to improve unattended productivity, not prohibit it. |
| Session Persistence, Objective Boundedness | The night may continue after a single objective is parked. |
| Productive Work Over Visible Motion | New branches, PRs, logs, and reruns count only when they materially advance the Night Plan. |
| External Budgets | The working agent cannot silently extend its own limits. |
| Park and Pivot | A pathological lane is preserved and left; the remaining queue continues. |
| One Active Candidate | Each deliverable has at most one active product candidate. |
| Semantic Loop Detection | Equivalent failures are recognized across changing wording, SHAs, and PR numbers. |
| Evidence Preservation | Parking never discards useful commits, logs, receipts, or diagnosis. |
| Credit Stewardship | Project Trim cost and context signals influence scheduling and repetition decisions. |
| Sounding Line Authority | Nightwatch never weakens, bypasses, or fabricates release evidence. |
| Restart Safety | Ledger, budgets, and counters survive compaction and restart. |
| Honest Morning Handoff | The owner receives completed outcomes, exact blockers, and resource use without narrative camouflage. |

> **Hard Boundary**  
> Nightwatch may choose which authorized objective to run next, but it may not reinterpret a failed Sounding Line decision as permission to bypass qualification, lower verification, modify protection, or manufacture authority.

---

## 6. Scope and Non-Goals

### 6.1 Governed Scope

- Night Plan creation and validation.
- Prioritized objective queues.
- Global and per-objective budgets.
- Failure fingerprinting and iterative-loop detection.
- Material-progress measurement.
- Candidate and PR lineage accounting.
- Scope-growth monitoring.
- Park, pivot, resume, complete, and abort transitions.
- Persistent unattended ledgers.
- Restart and morning-handoff behavior.
- Credit-aware scheduling through Project Trim contracts.
- Execution leases and mutation accounting.
- Bridgewatch visibility and alerts.
- Tier 1 incident capture and replay testing.

### 6.2 Non-Goals

- Nightwatch is not a replacement for Codex.
- Nightwatch is not a replacement for Sounding Line qualification.
- Nightwatch is not a new GitHub API or branch-protection authority.
- Nightwatch does not guarantee that every overnight objective completes.
- Nightwatch does not force the entire night to stop when one task becomes blocked.
- Nightwatch does not treat all long-running work as runaway work.
- Nightwatch does not permit unbounded paid usage merely because the owner requested overnight work.
- Nightwatch does not automatically absorb unrelated repository issues into the current objective.
- Nightwatch does not hide partial progress or call prerequisite activity equivalent to completion of the requested deliverable.

---

## 7. Canonical Ownership and Cross-Project Boundaries

### 7.1 Nightwatch Contract

Nightwatch owns:

> Unattended Codex orchestration, persistent overnight execution, objective budgeting, loop containment, productive task switching, and morning handoff.

### 7.2 Existing Project Contracts

| Project | Existing contract | Nightwatch relationship |
|---|---|---|
| Sounding Line | Verification planning, evidence validity, execution, and release decisions | Consumes qualification state; never replaces authority |
| Project Trim | Codex context and inference efficiency | Consumes cost, capsule, reuse, and context-efficiency signals |
| Breakwater | Deployment, infrastructure, release consumption, and platform operations | Uses operational runtime, process supervision, and platform facilities |
| Bridgewatch | Read-only project and repository command-center visibility | Publishes Nightwatch state, budgets, progress, and alerts |
| Deepwater | Capability audit, ownership, findings, and realization evidence | Registers ownership and audits implementation completeness |
| Fairlead | GitHub interaction and quota control plane | Consumes bounded GitHub operation and quota signals where applicable |

### 7.3 Ownership Rule

Nightwatch must compose existing authorities rather than copy them. It may ask Sounding Line what evidence is required, ask Project Trim what context can be reused, ask Fairlead whether a GitHub query is affordable, ask Breakwater to supervise an operational process, and send state to Bridgewatch. It must not fork those contracts into Nightwatch-only alternatives.

---

## 8. Canonical Nightwatch Architecture

Nightwatch contains eight logical components:

1. **Night Plan Validator** - validates scope, queue, budgets, deadlines, and owner authorization.
2. **Watch Dispatcher** - chooses the next eligible objective.
3. **Objective Controller** - manages one objective's attempts and state transitions.
4. **Progress Evaluator** - decides whether recent work materially advanced the plan.
5. **Loop Guard** - fingerprints failures and enforces iteration limits.
6. **Budget Broker** - accounts for time, mutations, PRs, validations, and available cost signals.
7. **Persistent Watch Ledger** - records restart-safe state and evidence pointers.
8. **Bridgewatch Projection** - exposes read-only operator status and morning reports.

The architecture uses two control levels:

- **Watch level:** manages the whole unattended session.
- **Objective level:** manages one bounded task lane.

An objective-level circuit breaker normally returns control to the Watch Dispatcher. Only global exhaustion, security failure, repository-integrity failure, or a terminal queue stops the whole watch.

---

## 9. Night Plan and Work Queue

### 9.1 Required Night Plan Fields

Every unattended run must declare:

- Session ID.
- Repository and default branch.
- Start time and wake-up deadline.
- Global runtime and cost policy.
- Ordered objective list.
- Scope allowlist for each objective.
- Objective budgets.
- Allowed mutation types.
- Fallback tasks.
- Owner-required escalation conditions.
- Morning-report destination.

### 9.2 Objective Classes

| Class | Meaning |
|---|---|
| `PRIMARY` | Core deliverable expected during the night |
| `SECONDARY` | Useful work after or between primary objectives |
| `FALLBACK` | Safe work used when primary lanes are parked or waiting |
| `HOUSEKEEPING` | Bounded cleanup, reconciliation, or archival work |
| `REPORT_ONLY` | Read-only audit or morning synthesis |

### 9.3 Queue Scheduling

The dispatcher selects the highest-priority objective that is:

- Authorized.
- Not complete.
- Not parked for the remainder of the watch.
- Within budget.
- Not waiting on an unresolved owner decision.
- Safe against current repository state.

If a primary objective waits on CI, the dispatcher may execute an independent objective. It must return when the waiting condition changes without reconstructing the entire context.

### 9.4 Work-Conserving Rule

Nightwatch should avoid idle time while authorized independent work exists. Parking one objective must release capacity to the remaining queue. This is the mechanism that reinforces unattended work rather than ending it.

---

## 10. Global Night Budget

The global budget governs the whole unattended session.

Required dimensions:

- Wall-clock deadline.
- Maximum authorized work duration.
- Paid-overage policy.
- Maximum total pull requests.
- Maximum total GitHub mutations.
- Maximum simultaneous active objectives.
- Maximum repository scope.
- Maximum aggregate full validations.

Global exhaustion stops the watch after a checkpoint. Objective exhaustion parks only the objective.

### 10.1 Global Budget Precedence

The most restrictive applicable boundary wins. No prompt phrase, task priority, or local diagnosis may override a global ceiling.

### 10.2 Telemetry-Unavailable Rule

If exact credit telemetry is unavailable, Nightwatch must still enforce wall-clock, mutation, attempt, validation, and no-progress limits. "Quota unknown" never means "quota unlimited."

---

## 11. Objective Budget

Each objective receives an independent budget.

Recommended default fields:

```json
{
  "objectiveId": "browser-contract-closure",
  "priority": "PRIMARY",
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

Budgets may be tightened by the Night Plan. Expansion requires an explicit owner-approved lease amendment and cannot occur merely because the owner is unavailable.

---

## 12. Objective State Machine

Canonical objective states:

```text
PLANNED
  -> PREFLIGHT
  -> ACTIVE
  -> WAITING_EXTERNAL
  -> COMPLETE
  -> PARKED_LOOP_GUARD
  -> PARKED_BUDGET
  -> PARKED_SCOPE
  -> PARKED_OWNER_REQUIRED
  -> ABORTED_INTEGRITY
```

### 12.1 Transition Rules

- `PLANNED -> PREFLIGHT`: required scope and authority route are inspected.
- `PREFLIGHT -> ACTIVE`: the objective has an eligible bounded execution path.
- `ACTIVE -> WAITING_EXTERNAL`: an external check is pending and independent work may proceed.
- `ACTIVE -> COMPLETE`: explicit completion predicates are satisfied.
- `ACTIVE -> PARKED_LOOP_GUARD`: repeated semantic failures reach the limit.
- `ACTIVE -> PARKED_BUDGET`: time, mutation, validation, or PR budget is exhausted.
- `ACTIVE -> PARKED_SCOPE`: path or diff growth exceeds authorization.
- `ACTIVE -> PARKED_OWNER_REQUIRED`: new authority or scope requires owner choice.
- `ANY -> ABORTED_INTEGRITY`: continuing could damage repository or security integrity.

Parking is a valid controlled outcome, not an agent failure to obey "continue."

---

## 13. Material Progress Model

### 13.1 Material Progress

Examples:

- Requested deliverable merged.
- Required prerequisite merged.
- Known blocker removed.
- Qualification advanced to a new authoritative state.
- Open or superseded PR count reduced.
- Root cause identified with new evidence.
- Objective moved closer to an explicit completion predicate.

### 13.2 Non-Progress

- Closing and recreating an equivalent candidate.
- Repeating unchanged tests without new evidence.
- Fetching unchanged logs repeatedly.
- Regenerating context already captured in the ledger.
- Renaming branches or PRs.
- Creating a successor with substantially the same effective diff and failure route.
- Producing more narrative about why the next attempt should work.

### 13.3 No-Progress Timer

Long-running commands may publish heartbeats, but a heartbeat proves liveness, not material progress. The default objective parks after 45 minutes without material progress unless its Night Plan contains a justified longer deterministic operation.

---

## 14. Iterative-Loop Detection

Nightwatch detects loops across:

- Repeated failure fingerprints.
- Equivalent candidate diff families.
- Successor PR lineage.
- Repeated protected-main reconciliation.
- Repeated full validation with no input change.
- Alternating failure patterns that return to the same state.
- Scope growth caused by absorbing each discovered prerequisite.

### 14.1 Cycle Rule

A cycle exists when the system returns to a previously recorded objective state without a meaningful reduction in unresolved blockers or an authoritative increase in evidence.

### 14.2 Alternating Loops

The detector must recognize `A -> B -> A -> B` patterns, not only identical consecutive failures.

### 14.3 Counter Reset Prohibition

The agent cannot reset loop counters by:

- Creating a new branch.
- Creating a new PR number.
- Renaming an objective.
- Rewording an error.
- Closing and reopening a candidate.
- Starting a new chat for the same objective lineage.

---

## 15. Failure Fingerprints

A normalized failure fingerprint includes:

- Objective family.
- Authority mode.
- Failed workflow and job.
- Failed step.
- Stable error code or semantic class.
- Changed-path class.
- Candidate lineage.
- Protected-base relationship.
- Proposed repair category.

Example:

```text
browser-contract-closure
normal-candidate
protected-binding
locate-sealed-explicit-authority
missing-qualification-envelope
```

### 15.1 Default Response

- First occurrence: diagnose and permit one bounded correction.
- Second equivalent occurrence: park the objective.
- Same failure after a repair claimed to address it: park immediately unless new evidence proves a distinct cause.

Fingerprints must be semantic. Different wording from GitHub, PowerShell, Node, or a wrapper must not create false novelty.

---

## 16. Park, Pivot, and Resume

### 16.1 Park Procedure

When parking an objective, Nightwatch must:

1. Stop new mutations for the objective.
2. Preserve current branch, commit, diff, and PR.
3. Record validation and authority evidence already completed.
4. Record the exact failure fingerprint.
5. Record budget use and attempt counts.
6. Identify the minimum safe next action.
7. Mark whether another queued objective could independently remove the blocker.
8. Return control to the Watch Dispatcher.

### 16.2 Pivot Procedure

The dispatcher selects the next eligible objective without losing the parked context. The remaining global budget stays available.

### 16.3 Resume Procedure

A parked objective may resume only when:

- The owner authorizes additional budget; or
- A separate completed objective independently removed its blocker; and
- The resume does not reset prior attempts or failure counters; and
- The Night Plan still has global budget.

An objective parked for repeated authority failure may not resume merely because `main` changed again.

---

## 17. Candidate and Pull-Request Lineage Control

### 17.1 One Active Candidate

Each deliverable may have at most one active product candidate. Prerequisite work may use separate PRs where anti-self-authorization requires it, but the product candidate remains one tracked lineage.

### 17.2 Draft-Until-Eligible

Where repository policy permits, the product candidate remains draft until authority prerequisites are present. It should not repeatedly become a new frozen PR before preflight proves an eligible qualification route.

### 17.3 Successor Limit

No more than two candidate successors are allowed by default. Each successor must record:

- Predecessor PR.
- Reason the predecessor is terminal.
- Effective diff relationship.
- New base and head.
- Remaining attempt budget.

### 17.4 Preflight Before Publication

Before creating or refreezing a candidate:

1. Construct the candidate locally.
2. Classify exact scope.
3. Determine authority mode.
4. Verify prerequisites exist on protected `main`.
5. Verify the qualification path can produce the required envelope.
6. Verify the objective has remaining attempt budget.
7. Only then create or update the candidate PR.

### 17.5 Supersession Hygiene

When a successor is valid:

- Close the predecessor.
- Link predecessor and successor.
- Preserve the terminal reason.
- Remove obsolete active status from the ledger.
- Schedule branch cleanup through ordinary repository policy.

---

## 18. Scope-Growth Control

Every objective begins with a path allowlist and a baseline effective-diff shape.

Default behavior:

| Growth | Action |
|---|---|
| Up to 125% of initial path count | Continue and record |
| Above 125% | Explain and classify |
| Above 150% | Freeze product work and split prerequisites |
| Above 200% or more than 10 additional files | Park objective |
| New unrelated project/governance domain | Owner approval required |

The reviewed product candidate grew from approximately 8-9 files to 32 files. Nightwatch would have parked it before this cross-domain expansion.

### 18.1 Discovery Is Not Authorization

Finding an unrelated defect permits recording it. It does not automatically authorize implementation. New work must fit the objective allowlist, prerequisite budget, time budget, and mutation lease.

---

## 19. Credit and Inference Efficiency

Nightwatch consumes Project Trim contracts for:

- Context capsules.
- Evidence reuse.
- Targeted context expansion.
- Cost estimation.
- Duplicate-read prevention.
- Validation reuse where authority permits.
- Compact state handoff between objectives.

### 19.1 Scheduling Objective

Nightwatch seeks to maximize:

> Useful completed work per authorized unit of time and inference across the complete Night Plan.

It does not maximize effort spent on the current objective.

### 19.2 Repeat Decision

Before repeating an expensive action, Nightwatch evaluates:

- Whether inputs changed.
- Whether the previous result remains valid.
- Probability that the repeat changes the outcome.
- Remaining objective and global budget.
- Whether another task offers greater expected value.

### 19.3 Paid Overage

Paid overage is an explicit Night Plan field. If denied or unspecified, Nightwatch must stop before entering it. If exact telemetry is unavailable, conservative proxy limits apply.

---

## 20. Execution Leases and Mutation Governance

### 20.1 Execution Lease

Each active objective receives a lease containing:

- Session and objective IDs.
- Repository and branch scope.
- Path allowlist.
- Expiration.
- Remaining mutation count.
- Remaining PR and refreeze count.
- Allowed authority mode.
- Paid-overage policy.

### 20.2 Lease Enforcement

Mutation helpers and Nightwatch-aware workflows must reject:

- Expired leases.
- Out-of-scope branches or paths.
- Excess PR generation.
- Budget-reset attempts.
- Objective IDs without a parent Night Plan.

### 20.3 Interactive and Unattended Modes

Interactive work may receive broader owner steering. Unattended work must load the Night Plan and enforce its leases. This is not a prohibition on unattended desktop use; it is the contract that makes such use safe enough to strengthen.

### 20.4 Unrestricted Credential Risk

Strong enforcement should route unattended GitHub mutations through a budget-aware broker or constrained credential. Repository checks alone can block merges but cannot prevent unlimited PR creation. Implementation must document the enforcement level honestly.

---

## 21. Persistent Ledger and Restart Recovery

### 21.1 Ledger Fields

The Watch Ledger records:

- Session identity and owner authorization.
- Start, deadline, and global budget.
- Current protected-main SHA.
- Ordered objective queue.
- Active, complete, parked, and waiting objectives.
- Current branches, commits, and PRs.
- Candidate lineage and predecessors.
- Failure fingerprints.
- Validation and authority receipts.
- Last material-progress timestamp.
- Scope and mutation counters.
- Next safe action.

### 21.2 Restart Safety

On restart, Nightwatch must:

1. Read the ledger.
2. Fetch fresh repository state.
3. Reconcile recorded objects without resetting counters.
4. Retire stale leases.
5. Resume the dispatcher at the next eligible state.

Laptop reboot, session compaction, or a new chat must not erase objective history.

### 21.3 Tamper Evidence

Accepted ledgers should use stable schemas and integrity digests. Manual correction must be recorded as a new event rather than rewriting history silently.

---

## 22. Prompt and Mandate Safety

### 22.1 Dangerous Mandates

Nightwatch validates prompts containing phrases such as:

- Run until completion.
- Do not stop.
- Run all night.
- Retry until successful.
- Continue through every blocker.
- I will be unavailable.
- Do not stop merely to conserve quota.

These phrases are allowed only when a Night Plan provides explicit global and objective limits.

### 22.2 Contradiction Rule

If one instruction prioritizes conservation and another grants unlimited persistence, Nightwatch rejects the mandate and reports the conflict before starting.

### 22.3 Precedence

Nightwatch precedence is:

1. Security and repository integrity.
2. Global Night Plan limits.
3. Objective limits and circuit breakers.
4. Sounding Line authority.
5. Objective completion language.
6. Optional cleanup and reporting preferences.

Completion language can never outrank budgets or integrity.

---

## 23. Bridgewatch Command Center

Bridgewatch should expose a Nightwatch panel containing:

- Session start and wake-up deadline.
- Current global budget state.
- Active objective.
- Queue order.
- Completed and parked objectives.
- Runtime per objective.
- PRs created, merged, closed, and active.
- Candidate generations.
- Failure fingerprints.
- Scope-growth alarms.
- Time since material progress.
- Current CI and authority state.
- Paid-overage policy.
- Morning-report readiness.

Recommended status language:

- `ON_WATCH`
- `WAITING_EXTERNAL`
- `PARKING_OBJECTIVE`
- `PIVOTING`
- `GLOBAL_BUDGET_WARNING`
- `WATCH_COMPLETE`
- `WATCH_STOPPED_INTEGRITY`

Recommended severity colors:

- Green: under 50% of local budget.
- Yellow: 50-80%.
- Orange: 80-100%.
- Red: objective parked or global breaker active.
- Black: mutation attempted after lease expiration.

---

## 24. Alerts, Escalation, and Morning Handoff

### 24.1 Tier 1 Alert Conditions

- Same semantic failure twice.
- Third candidate successor.
- More than five PRs in one lineage.
- Scope exceeds 200%.
- No material progress for the objective limit.
- Paid overage would begin without authorization.
- Agent attempts to extend or reset its own budget.
- Global budget is exhausted.

Objective alerts normally park the lane before notifying. They do not wait for a sleeping owner while continuing the same work.

### 24.2 Morning Report

The report must contain:

- Starting and ending `main` SHAs.
- Objectives completed.
- Objectives parked and why.
- PRs merged, closed, and left open.
- Material repairs made.
- Tests and authority results.
- Runtime and budget usage.
- Paid-overage status.
- Exact continuation actions.

The report must distinguish prerequisite progress from completion of the requested deliverable.

---

## 25. Security, Privacy, and Public-Repository Safety

- Nightwatch must not store credentials, tokens, session secrets, or private chat content in repository ledgers.
- Public incident records must minimize personal billing details unless the owner explicitly authorizes them.
- Cost records should prefer bounded operational facts such as "declared quota exhausted" and "paid overage began."
- GitHub mutation brokers must use least privilege.
- Ledger events must redact private local paths where disclosure is unnecessary.
- Bridgewatch projections must expose operational status without leaking credentials or private content.

---

## 26. Failure and Fallback Behavior

| Failure | Required behavior |
|---|---|
| Exact credit telemetry unavailable | Enforce time, mutation, PR, validation, and no-progress limits |
| GitHub API quota low | Use Fairlead-bounded queries, local evidence, and cached results |
| Protected `main` advances | Reconcile within restart budget; park after limit |
| Same authority failure repeats | Park objective and pivot |
| CI pending | Mark waiting; work an independent objective |
| CI flakes once | Permit one bounded retry |
| CI flakes repeatedly | Fingerprint and park |
| Scope expands | Split prerequisite or park according to thresholds |
| Laptop restarts | Recover ledger without resetting counters |
| All objectives parked | Produce morning report and end watch |
| Security or integrity uncertainty | Stop global watch fail closed |

Nightwatch must never interpret missing telemetry, missing authority, or missing owner presence as permission for unlimited continuation.

---

## 27. Testing and Acceptance Matrix

| Area | Required proof |
|---|---|
| Night Plan validation | Invalid, conflicting, or unbounded mandates fail before execution |
| Queue scheduling | Blocked primary pivots to eligible secondary/fallback work |
| Objective budgets | Each hard limit parks the objective deterministically |
| Global budgets | Global exhaustion checkpoints and ends the watch |
| Failure fingerprints | Equivalent wording maps to one semantic failure |
| Alternating loops | `A-B-A-B` cycles are detected |
| Candidate lineage | Branch/PR renaming cannot reset counters |
| One active candidate | Duplicate live product candidates are rejected |
| Scope growth | 125%, 150%, and 200% boundaries behave as specified |
| Material progress | Activity without objective advancement does not reset timer |
| Waiting CI | Independent objectives continue without duplicating context |
| Restart safety | Counters and states survive restart |
| Paid overage | Unauthorized transition is prevented |
| Bridgewatch | Projection matches authoritative ledger |
| Morning report | Completed, parked, and partial outcomes are distinct |
| Incident replay | The `#302-#334` scenario parks before excessive churn and continues other work |

### 27.1 Founding Incident Replay Requirement

The replay must model:

- Browser product candidate creation.
- Mixed Tideglass fixture failure.
- Shipwright fixture and engine prerequisites.
- Browser partition normalization.
- Governed Shipwright runner admission.
- P34 ledger admission.
- Repeated missing explicit authority.
- Scope growth.
- Candidate successor churn.

Acceptance requires that the browser lane parks no later than the earliest of:

- Five generated PRs.
- Two hours of objective time.
- The second equivalent explicit-authority failure.
- 200% scope growth.

The dispatcher must then continue with another authorized objective.

### 27.2 Adversarial Cases

- Error text changes while semantic cause remains.
- Agent creates a new objective ID to evade counters.
- Agent closes and recreates branches.
- Main advances continuously.
- CI never finishes.
- Test flakes alternate with authority failures.
- Credit telemetry disappears.
- Supervisor restarts.
- Worktree survives but remote branch disappears.
- All fallback objectives are exhausted.

---

## 28. Implementation Phases

### Phase 0 - Preserve the Watch

- Record the founding Tier 1 incident.
- Preserve the `#302-#334` lineage as replay evidence.
- Record prompt contradiction and impact.
- Freeze the final reviewed state.
- Establish Nightwatch ownership proposal.

### Phase 1 - Set the Night Plan

- Implement Night Plan schema and validator.
- Define global and objective budgets.
- Implement prompt contradiction checks.
- Define objective state transitions.
- Register Nightwatch governance and cross-project boundaries.

### Phase 2 - Keep the Ledger

- Implement persistent Watch Ledger.
- Implement restart and compaction recovery.
- Track candidate lineage, failures, scope, and progress.
- Integrate Project Trim context capsules.

### Phase 3 - Guard the Lanes

- Implement failure fingerprints.
- Implement loop and alternating-cycle detection.
- Implement scope-growth tripwires.
- Implement material-progress timers.
- Implement park, pivot, and resume.

### Phase 4 - Run the Watch

- Implement Watch Dispatcher and Objective Controller.
- Implement execution leases and mutation accounting.
- Integrate Sounding Line state.
- Integrate Fairlead GitHub quota behavior.
- Integrate Breakwater runtime supervision.

### Phase 5 - Raise the Command Center

- Add Nightwatch state to Bridgewatch.
- Add alerts, budgets, queue, and progress displays.
- Add morning reports and continuation controls.
- Add incident-history navigation.

### Phase 6 - Prove the Dawn

- Replay the founding incident.
- Run adversarial scenarios.
- Prove restart safety.
- Conduct a supervised synthetic overnight session.
- Demonstrate useful work continues after a lane parks.
- Activate Nightwatch as the required unattended operating contract.

---

## 29. Final Acceptance Criteria

Nightwatch v1.0 is accepted only when:

1. Unattended work remains supported and can span an authorized night.
2. Every run has a validated Night Plan.
3. Global and objective budgets are independently enforced.
4. A parked objective does not unnecessarily end the session.
5. Equivalent repeated failures are detected semantically.
6. No objective exceeds its PR, refreeze, prerequisite, or scope limits.
7. One active product candidate exists per deliverable.
8. Counters cannot be reset by new branches, PRs, chats, or wording.
9. Missing credit telemetry cannot produce unlimited work.
10. Unauthorized paid overage is prevented by available enforcement boundaries.
11. The ledger survives restart and reflects remote reality.
12. Bridgewatch displays authoritative session state.
13. The morning report distinguishes completion, partial progress, and parked blockers.
14. The founding incident replay parks the lane before excessive churn.
15. After parking that lane, another authorized objective completes successfully.

The governing success condition is not "Codex never fails." It is:

> No unattended objective may silently continue beyond its authorized time, attempt, scope, PR, validation, or cost boundaries, and no single pathological objective may consume the useful remainder of an authorized night.

---

## 30. Governance and Change Control

### 30.1 Authority

This document defines the Nightwatch governing baseline. Implementation records may refine mechanics but may not weaken the non-negotiable principles without a versioned governing amendment.

### 30.2 Threshold Changes

Default thresholds may be tuned from measured evidence. Any increase must document:

- The workload class requiring it.
- Expected benefit.
- New maximum exposure.
- Replay and adversarial evidence.
- Owner approval.

### 30.3 Incident Amendments

New runaway or near-miss incidents must append evidence and tests. History must not be rewritten to make the system appear more successful than it was.

### 30.4 Cross-Project Amendments

Changes affecting Sounding Line authority, Project Trim evidence reuse, Breakwater operations, Fairlead quota control, Bridgewatch projection, or Deepwater ownership must follow those projects' existing governance and acceptance paths.

### 30.5 No Self-Authorization

Nightwatch cannot modify its own budget enforcement and use the modified behavior to qualify that same change. Anti-self-authorization boundaries remain mandatory.

---

## 31. Glossary

| Term | Definition |
|---|---|
| Night Plan | Authorized manifest for one unattended session |
| Watch | The complete unattended session |
| Objective | One bounded task lane inside a watch |
| Global budget | Limits applying to the whole watch |
| Objective budget | Limits applying to one objective |
| Material progress | Evidence that an objective measurably advanced |
| Failure fingerprint | Semantic identity for a failure across changing surface details |
| Park | Preserve and suspend a pathological or exhausted objective |
| Pivot | Move capacity to another authorized objective |
| Resume | Continue a parked objective without resetting history |
| Execution lease | Bounded authorization for an objective's operations |
| Watch Ledger | Persistent authoritative record of session state |
| Candidate lineage | Related branches and PRs pursuing the same deliverable |
| Morning handoff | Final report for the returning owner |

---

## 32. Appendix A - Default Thresholds

| Metric | Warning | Default action limit |
|---|---:|---:|
| Objective wall time | 60 minutes | Park at 90 minutes |
| No material progress | 20 minutes | Park at 45 minutes |
| Same semantic failure | First repeat | Park at second occurrence |
| Candidate successors | 1 | Park before third |
| Prerequisite PRs | 1 | Park before third |
| New PRs in one lineage | 3 | Park at 5 |
| Concurrent product candidates | N/A | Reject above 1 |
| Protected-main restarts | 1 | Park after 2 |
| Full qualification runs | 1 | Park after 2 without progress |
| Scope growth | 125% | Park at 200% or +10 files |
| Global budget | 50% | Warn at 80%; stop at 100% |

Thresholds are defaults, not universal estimates. The Night Plan may assign smaller limits. Larger limits require owner-approved evidence.

---

## 33. Appendix B - Founding Incident Evidence

### B.1 Merged Repairs

| PR | Outcome |
|---|---|
| `#305` | Mixed Tideglass browser fixtures partitioned |
| `#311` | Shipwright browser fixture isolated |
| `#315` | Shipwright browser engine registered |
| `#318` | Browser-selection partitions normalized |
| `#330` | Governed Shipwright runner admitted |
| `#333` | Generated P34 browser ledgers admitted |

### B.2 Terminal Reviewed Candidate

| Field | Value |
|---|---|
| PR | `#334` |
| Head | `511570d723aad5ba17a9a42f2eaf6c23a9611bce` |
| Base | `d7e3f2f873139e3f7353bf288124f50543ce2aac` |
| Files | 32 |
| Additions | 1,671 |
| Deletions | 1,089 |
| Protected binding | Failed |
| Failure step | `Locate sealed explicit authority` |

### B.3 Counterfactual Nightwatch Outcome

Nightwatch would have:

1. Allowed initial focused diagnosis.
2. Allowed a bounded prerequisite repair.
3. Recognized repeated authority and candidate-lineage failures.
4. Parked the product lane before excessive PR generation or scope growth.
5. Continued with Tideglass cleanup and supersession work.
6. Produced a morning report with preserved state and unused global capacity.

---

## 34. Appendix C - Example Night Plan

```json
{
  "schemaVersion": "1.0.0",
  "sessionId": "nightwatch-2026-08-20-home",
  "repository": "Kgray44/treasurehuntSoT",
  "baseBranch": "main",
  "mode": "unattended",
  "wakeDeadline": "2026-08-20T07:00:00-04:00",
  "globalBudget": {
    "wallClockMinutes": 420,
    "maxNewPullRequests": 8,
    "maxFullQualificationRuns": 6,
    "paidOverage": false
  },
  "objectives": [
    {
      "id": "browser-contract-closure",
      "class": "PRIMARY",
      "priority": 1,
      "wallClockMinutes": 90,
      "maxNewPullRequests": 5,
      "maxCandidateRefreezes": 2,
      "maxRepeatedFailureSignatures": 2,
      "noMaterialProgressMinutes": 45
    },
    {
      "id": "tideglass-fixture-closure",
      "class": "PRIMARY",
      "priority": 2,
      "wallClockMinutes": 75,
      "maxNewPullRequests": 3
    },
    {
      "id": "superseded-pr-cleanup",
      "class": "HOUSEKEEPING",
      "priority": 3,
      "wallClockMinutes": 45,
      "maxNewPullRequests": 0
    },
    {
      "id": "morning-repository-capsule",
      "class": "REPORT_ONLY",
      "priority": 99,
      "wallClockMinutes": 20
    }
  ]
}
```

---

## 35. Appendix D - Example Morning Report

```text
PROJECT NIGHTWATCH - MORNING HANDOFF

Watch: nightwatch-2026-08-20-home
Runtime: 6h 41m of 7h authorized
Paid overage: not entered
Starting main: <sha>
Ending main: <sha>

COMPLETE
- Tideglass fixture closure: merged PR #...
- Superseded PR cleanup: 11 closed, 0 ambiguous
- Repository capsule: published

PARKED
- Browser product contracts
  Reason: repeated authority.normal-candidate.missing-explicit-envelope
  Attempts: 2/2
  PRs created: 3/5
  Last candidate: #...
  Preserved head: <sha>
  Minimum next action: inspect candidate authority dispatch contract

GLOBAL BUDGET
- Runtime used: 95%
- PR budget used: 50%
- Full qualifications: 3/6
- Remaining objectives: none eligible

No security bypass, protection change, or unapproved paid usage occurred.
```

---

**End of Project Nightwatch Governing Document v1.0**
