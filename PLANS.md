# Repository execution-planning standard

This document defines how Codex plans and coordinates work in this repository. It is a reusable execution standard, not a plan for one feature or audit. Root `AGENTS.md` supplies the governing behavior, requires this file at the thresholds below, and remains the automatically discovered repository instruction source. Current user instructions and governing product documents continue to define scope and desired results.

Root `PLANS.md` does not replace `Development_Docs`. When a task requires a durable authored plan or implementation record, store that task-specific artifact under `Development_Docs` in accordance with its rules. A plan may otherwise remain in the task's coordination state or in the user-requested artifact.

## Elapsed-time planning priority

Correctness, completeness, user intent, safety, required evidence, ownership discipline, and validation quality are hard constraints. Within those constraints, every plan must organize scheduling, delegation, worker capability, integration, and validation to produce the correct integrated result in the minimum practical elapsed time. Speed is an explicit planning objective, not merely a possible by-product of parallelization.

When multiple safe and correct decompositions exist, prefer the one expected to finish sooner while delivering the required depth, coverage, and verification. Minimize avoidable waiting, duplicate work, oversized planning ceremony, repeated discovery, delayed review, and unnecessary global validation. Do not trade required evidence, accessibility, security, performance analysis, testing, or acceptance criteria for speed, and do not invent duration estimates or improvement percentages when no timing data was recorded.

## Progressive planning tiers

Every task gets a parallelization assessment, but planning ceremony scales with task size and risk.

### Tier 0: localized task

Use Tier 0 only when the task is genuinely small, scope is narrow, one file or a tightly related file group is involved, no meaningful independent workstream exists, no shared runtime/database/migration/lockfile/deployment risk exists, and delegation would cost more than it saves.

Tier 0 records only the objective, affected scope, quick parallelization assessment, focused validation, and finalization. A distinct verification lane may still be useful.

### Tier 1: standard multi-step task

Use Tier 1 for medium work. Record the objective; scope and exclusions; governing sources; repository/working-tree reality; assumptions and unknowns; compact dependency graph and parallelization assessment; critical path and elapsed-time strategy; lane matrix; subagent communication plan; file and shared-resource ownership; focused testing; integration; and final verification. For each proposed lane, record its expected capacity, quality or coverage, elapsed-time, independence, and coordinator-integration value as defined below. The lane matrix must include the user-visible worker identity, announcement, ownership, lifecycle, deliverable, benefit, time-aware, and integration fields defined below. Use two to five workers when that many meaningful lanes exist.

### Tier 2: large or high-risk task

Use the complete template in this file for repository-wide audits, large implementations, major refactors, multiple feature surfaces, database changes, migrations, deployment, high-risk security work, architecture changes, long-running or cross-computer work, tasks with six or more meaningful lanes, or work with substantial context/coordination-loss risk. Record the critical path and complete elapsed-time strategy, plus the expected capacity, quality or coverage, elapsed-time, independence, and coordinator-integration value of every proposed lane. The complete lane matrix and subagent communication plan are mandatory whenever workers are used. Target six to twelve direct workers when the dependency graph and installed capacity support that many real lanes.

## Progressive planning rule

Minimum safe preflight comes first. Identify immediately ready independent lanes, publish the required compact worker manifest, launch safe read-only lanes without unnecessary delay, and refine the dependency graph and detailed plan while they run. No write lane begins before its requirements, prerequisites, file/resource ownership, and integration boundaries are sufficiently established and every assigned path has passed the write-lane path-verification gate below. Launch write lanes as soon as those conditions are met, keep the highest-value ready work in available slots, and start newly unblocked work immediately. Safe read-only discovery continues while unresolved paths are being identified or verified.

Before or immediately after any launch, disclose the worker manifest in chat as required by the subagent communication plan; planning refinement never makes a launched worker invisible. Communication must not become a blocking administrative process: do not delay a safe worker merely to produce elaborate formatting. Plans are living coordination artifacts, not paperwork gates; make them detailed enough to protect quality without delaying safe useful work. "Complete every planning table before starting any worker" is prohibited when ready read-only lanes exist.

## Planning principles

An execution plan must:

- be self-contained enough for another coordinator to continue without rediscovering the task;
- preserve the exact user goal, terminology, constraints, acceptance criteria, methodology, and output format;
- separate requirements and invariants from implementation choices;
- identify verified facts, assumptions, unknowns, and canonical sources;
- represent work as a dependency graph rather than a falsely linear checklist;
- identify the critical path and organize work to shorten it without weakening any hard constraint;
- maximize safe, useful concurrency while identifying conflict-prone and serialized work;
- establish one coordinator, clear lane ownership, and one writer per file at a time;
- verify assigned write-lane paths against the current repository and distinguish verified existing files, intentional new files, and unresolved read-only paths;
- identify shared runtime and expensive resources with authoritative owners;
- define evidence, focused validation, integration validation, and completion criteria before implementation;
- remain updateable as discoveries change scope, dependencies, ownership, risk, or validation;
- make every subagent launch and material lifecycle change visible to the user through concise structured chat updates;
- use completed results promptly and integrate safe independent work incrementally rather than waiting for unrelated lanes;
- record significant decisions and discoveries without exposing private chain-of-thought; and
- preserve completed work when the plan changes.

## Capacity and wave scheduling

Record:

```text
Configured open-thread capacity:
Coordinator reservation:
Maximum normal direct workers:
Current ready lanes:
Currently active lanes:
Blocked lanes:
Available slots:
Next ready lanes:
Highest-value ready-lane queue:
Exclusive resources currently held:
```

Keep safe capacity filled with the highest-value ready meaningful work, reserve the coordinator when the client counts the root session, and maintain ready and next-ready queues for substantial tasks. Fill each newly available slot immediately rather than waiting for an entire wave. Capacity may remain intentionally unused only when no useful independent work exists or a concrete conflict, dependency, safety, or resource constraint prevents more work. When substantial ready work exists but a slot remains unused, record the reason briefly.

Do not require a fixed worker count when fewer meaningful lanes exist, and do not create a lane merely because capacity is available. When enough real non-overlapping work exists, use the full safe and useful lane count. Avoid idle or artificial workers, stop or collapse redundant work after sufficient evidence exists, preserve results between waves, and keep completed high-priority output moving into review and integration.

## Worker capability and reasoning-speed planning

Route work for both reliability and elapsed time. Use the fastest capable available worker configuration for mechanical inventories, repository searches, classifications, repetitive comparisons, and bounded read-only scans. Reserve high reasoning effort for work that actually needs it, and use stronger workers for difficult architecture, diagnosis, implementation, reconciliation, and verification. Do not assign maximum reasoning effort to every worker by habit.

Record any capability or reasoning requirement that materially affects lane success or urgency. Reassign work from an unnecessarily slow configuration when a faster capable worker can complete it reliably, and split broad work when that shortens the critical path without losing useful context. Do not hardcode model names or capabilities that were not verified in the installed client.

## Lane-decomposition quality check

Before spawning a worker, confirm:

- the lane has a distinct result and evidence or ownership boundary;
- it can proceed without another lane's unfinished result;
- it can run without conflicting writes;
- any exclusive resource and its owner are explicit;
- its output materially helps the final result and does not duplicate another lane;
- the selected worker is capable of completing it independently;
- the return format is clear; and
- the coordinator can integrate the result.

Merge or serialize lanes that fail this check.

Apply this lane-value check to every proposed Tier 1 and Tier 2 lane:

- Does this lane increase useful work capacity?
- Does it add distinct expertise, evidence, implementation, testing, or verification?
- Can it reduce the task's critical-path duration?
- Will this lane reduce total elapsed completion time?
- Does it remove work from the critical path?
- Can it execute simultaneously with existing lanes?
- Will its expected time savings exceed briefing, monitoring, and integration overhead?
- Would combining it with another lane be faster?
- Would splitting a slow or broad lane shorten the critical path?
- Is the worker capability appropriate for the lane's urgency and complexity?
- Can the result be reviewed and integrated promptly?
- Is its expected value greater than its delegation and integration overhead?
- Can its output be integrated without creating conflicts or duplicated work?

A lane should normally be created when it provides at least one strong benefit in speed, capacity, quality, coverage, verification, or risk reduction and does not create disproportionate conflict or coordination cost. A lane that fails this value check should be revised, combined, split, reassigned, serialized, or omitted rather than used ceremonially.

## Write-lane path-verification gate

Before launching any write-enabled subagent, the coordinator must:

- resolve the current repository root and verify every assigned existing file path against that current repository;
- record each assigned file using its exact canonical repository path, not shorthand, a basename alone, an inferred filename, or an unverified location;
- determine whether every assigned path that does not exist is intentionally being created or remains unresolved;
- label each intended new file explicitly as **intentional new-file ownership** before granting write authorization;
- label each confirmed existing file explicitly as **verified existing-file ownership**;
- label every unresolved or unverified path explicitly as **unresolved path — read-only**, and keep the affected lane read-only until verification or intentional-new-file classification is complete; and
- confirm one-writer ownership and integration boundaries only after these path states are known.

A directory or path pattern may define the outer ownership boundary, but it does not replace verification of each assigned existing file. A writer must not launch against an unresolved, inferred, or unverified path. Path resolution must not stall independent work: continue safe read-only discovery while paths are being resolved, then update the plan and visible manifest before changing the lane to write-enabled.

## Complete Tier 2 execution-plan template

Tier 2 uses every section below. Tier 1 uses the identified compact subset; Tier 0 uses its stated minimum. "Not applicable" is acceptable only with a short reason.

### 1. Task identity

```text
Task title:
Date:
Coordinator:
Repository and root:
Current branch/worktree and commit:
Governing documents:
Related issue, phase, audit, or feature:
Current task instructions:
Plan location/status:
```

Copy or faithfully summarize the controlling task instructions. Link to the full source when a summary could lose detail.

### 2. Objective

Record:

- desired end state;
- user-visible outcome;
- technical outcome; and
- why the work is being done.

Use outcome language. Do not describe activity alone as success.

### 3. Scope

Record:

- included work;
- explicit exclusions;
- areas and behaviors that must remain unchanged;
- existing completed or uncommitted work that must be preserved; and
- actions that require separate user authority.

Parallelization never broadens this scope.

### 4. Sources of truth

List, in priority order:

- current user instructions;
- governing specifications and approved `Development_Docs` material;
- maintained architecture, security, testing, and operational documentation;
- canonical code and data directories;
- relevant tests and runtime evidence;
- external dependencies or authoritative external documentation; and
- the rule to apply when sources disagree.

State which facts were verified in the current task and which were inherited or require confirmation.

### 5. Repository reality check

Before delegation or modification, capture:

```text
Git repository root:
Canonical remote/repository:
Active application:
Active branch and HEAD:
Upstream and ahead/behind/diverged state:
Complete working-tree classification:
Canonical startup command:
Required application port:
Relevant focused and full validation commands:
Generated, archived, obsolete, or excluded trees:
Existing uncommitted work and owner/provenance if known:
Safe synchronization action taken or deferred:
```

For this repository, verify rather than assume the current baseline. The expected canonical shape is one root Next.js application on `main`, normal startup through `npm run dev:full`, and normal development port `3000`. If reality differs, stop treating the expectation as fact and update the plan.

Do not inspect secrets, overwrite local databases, or treat generated validation copies as source. Classify unrelated and pre-existing work before editing.

### 6. Assumptions and unknowns

Use this table:

| ID  | Assumption or unknown | Impact if wrong | Verification method | Responsible lane | Can work proceed first? | Status/evidence |
| --- | --------------------- | --------------- | ------------------- | ---------------- | ----------------------- | --------------- |
| A1  |                       |                 |                     |                  | Yes/No                  |                 |

Do not silently convert an unknown into a requirement or conclusion.

### 7. Parallelization assessment

Answer explicitly:

- Which work is meaningfully independent?
- Which work depends on another result?
- Which lanes can begin immediately?
- Which steps must be serialized, and for what concrete reason?
- Which resources are shared or exclusive?
- Which files or interfaces are conflict-prone?
- Which work should be read-only?
- Which write lanes need isolated worktrees?
- What is the maximum safe and useful concurrency under current capacity?
- Why does the chosen decomposition improve speed, coverage, reliability, or context management without redundant work?
- What conditions would cause a lane to be split, collapsed, cancelled, or serialized?

For every proposed Tier 1 and Tier 2 lane, record the following in the assessment, lane matrix, or an adjacent lane record:

```text
Capacity benefit:
Quality or coverage benefit:
Elapsed-time benefit:
Why this lane should run independently:
Expected coordinator integration cost:
```

These entries must state the expected task benefit and likely coordination cost concretely enough to support the lane-value check. They may be concise, but they must distinguish meaningful capacity, specialization, evidence, implementation, testing, verification, or critical-path value from artificial worker count.

For a substantial task that remains primarily sequential, document the dependency, safety, exclusive-resource, or overlapping-file reason. Ease of coordination is not enough.

### 8. Elapsed-time strategy

Every Tier 1 and Tier 2 plan must identify the task's critical path and record:

```text
Critical path:
Earliest safe fan-out point:
Ready lanes at launch:
Highest-risk dependency to resolve early:
Expected serialized bottlenecks:
Incremental integration opportunities:
Expensive shared operations:
Worker-slot utilization strategy:
Conditions for splitting or reassigning a slow lane:
Conditions allowing work to proceed before all lanes finish:
```

The strategy must explain which work directly controls final completion time and how the plan will launch that work as early as safely possible. Move prerequisite discovery off the critical path through bounded parallel read-only lanes where useful; prioritize uncertain or high-risk dependencies early; prevent noncritical work from blocking critical work; and start newly unblocked work immediately. Begin implementation once sufficient verified inputs exist, review high-priority completed results promptly, and integrate completed independent work incrementally when safe instead of waiting for unrelated lanes.

Record how the coordinator will avoid becoming the critical-path bottleneck, how ready and next-ready lanes will keep meaningful capacity occupied, and when a slow or broad lane should be split or reassigned without discarding useful work. Do not require speculative duration estimates or invented percentages. Base the strategy on dependencies, readiness, ownership, risk, shared resources, and observed evidence.

### 9. Dependency graph

Represent lane identifiers, prerequisites, fan-out, fan-in, the critical path, and failure independence. A compact text or Mermaid graph is acceptable. For example:

```text
P0 repository preflight
|-- R1 read-only subsystem inventory --\
|-- R2 read-only test/risk inventory ----+-- I1 coordinator reconciliation
`-- R3 read-only requirements review ---/
                                         |-- W1 isolated implementation lane --\
                                         `-- W2 isolated implementation lane --+-- I2 shared-file integration
                                                                                 `-- V1 integrated validation
                                                                                     `-- F1 finalization
```

Annotate:

- prerequisites and blocking relationships;
- ready work and fan-out points;
- integration/fan-in points;
- the critical path;
- serialized shared-resource operations; and
- lanes that can continue if another lane fails.

Do not force parallel work into a fake sequential checklist.

### 10. Workstream matrix

Every Tier 1 and Tier 2 workstream matrix must contain fields equivalent to the following. Keep the entries compact enough to scan; an adjacent lane record may carry details, but no required field may be omitted.

| Lane ID | Visible worker name/role | Chat announcement status | User-visible objective | Mode      | Ownership: concern and exact paths | Path ownership classification/verification | Explicit non-scope/prohibited resources | End goal | Expected deliverable | Expected benefit | Dependencies | Shared resources not controlled/authoritative owner | Integration path/owner | Completion criteria | Required evidence/focused validation | Current status | Completion announced | Integration status | Blockers |
| ------- | ------------------------ | ------------------------ | ---------------------- | --------- | ---------------------------------- | ------------------------------------------ | --------------------------------------- | -------- | -------------------- | ---------------- | ------------ | --------------------------------------------------- | ---------------------- | ------------------- | ------------------------------------ | -------------- | -------------------- | ------------------ | -------- |
| R1      |                          | Pending                  |                        | Read-only |                                    | Unresolved path — read-only                |                                         |          |                      |                  |              |                                                     | Coordinator            |                     |                                      | Ready          | No                   | Not started        |          |

Every lane must have a non-overlapping evidence or edit boundary. If two write lanes need the same file, change the ownership or serialize the handoff before either edits.

For a write-enabled lane, ownership must list the exact canonical repository paths of the files it may edit; any verified path pattern, component, or package boundary; exact shared files it may not edit; whether it uses an isolated worktree; the integration owner; and the ownership handoff condition. The path-classification field must distinguish **verified existing-file ownership**, **intentional new-file ownership**, and **unresolved path — read-only**, with enough evidence to show that assigned existing files were checked against the current repository. A nonexistent path receives write authorization only when its creation is intentional and labeled as new-file ownership. If clear write ownership or path status cannot be recorded and announced, keep the lane read-only. Shared-resource entries name the authoritative owner of every applicable server, port, browser, database, schema, migration chain, dependency installation, manifest, lockfile, full build, full E2E, full validation, generated asset, Git integration, and final synchronization resource.

Update announcement, completion, and integration fields whenever the worker topology or lifecycle changes. Distinguish **worker complete**, **output reviewed**, **output integrated**, and **output independently verified**; none implies the next automatically.

For every Tier 1 and Tier 2 lane, include these time-aware fields in the matrix or an adjacent lane record:

```text
Critical-path relationship:
Earliest safe start:
Expected blocking dependencies:
Elapsed-time benefit:
Can integration begin before other lanes finish?
Reassignment or split trigger:
```

Use dependency and readiness evidence rather than speculative duration estimates. A lane record must make clear whether its result can be reviewed or integrated while unrelated work continues.

### 11. Subagent communication plan

Subagent use must never be invisible to the user. Every Tier 1 or Tier 2 plan that uses workers must include a communication plan covering the items below. If a Tier 0 task uses a distinct verification or other worker, the same launch and lifecycle disclosures apply even though the full planning template does not. These rules apply to one worker, multiple specialists, full-capacity fan-out, later waves, replacements, verification lanes, read-only or write lanes, test lanes, and batch workers.

#### Initial manifest format and launch timing

Before or immediately after launching workers, provide a visible chat update titled `Subagent started`, `Subagents started`, or an equally clear wave-specific title. Never omit the disclosure for a single worker. Use a compact structured card for one worker and one grouped table for workers launched at approximately the same time. Prepare and publish the minimum sufficient disclosure promptly; do not delay a safe launch to create elaborate presentation.

For each worker, the launch update must disclose:

- lane ID and visible subagent name or role;
- current status, primary objective, end goal, and why the lane exists;
- read-only or write-enabled mode;
- owned subsystem, concern, files, paths, components, or evidence boundary;
- path ownership status distinguishing verified existing-file ownership, intentional new-file ownership, and unresolved paths that keep the lane read-only;
- explicit non-scope, forbidden paths, and prohibited resources;
- expected deliverable and completion criteria;
- dependencies and prerequisite evidence;
- shared resources it may not control and their authoritative owners;
- how the coordinator will review and integrate the output; and
- expected capacity, quality, coverage, verification, specialization, or elapsed-time benefit.

For each write-enabled worker, the visible launch update must make ownership unmistakable: list the exact canonical repository paths it may edit; classify each as verified existing-file ownership or intentional new-file ownership; list any verified outer path pattern, component, or package boundary; identify exact shared files it may not edit; and state whether it has an isolated worktree, the integration owner, and the handoff condition. An unresolved or unverified path must be shown as unresolved in the manifest and keeps the lane read-only until the coordinator verifies the existing path or confirms and announces intentional new-file ownership. Never launch a writer using shorthand or an inferred filename. Safe read-only lanes may continue while this resolution occurs.

When several workers launch together, use a manifest such as:

```text
Subagents started: <count>

| Lane | Role | Status | Mode | Exact ownership | Path status | End goal/deliverable | Non-scope | Dependencies | Integration | Expected benefit |
|------|------|--------|------|-----------------|-------------|----------------------|-----------|--------------|-------------|------------------|
```

For one worker, use a compact card containing the same information rather than omitting fields because a table seems unnecessary.

Every launch update must also state:

- total workers launched in that update and direct-worker slots still available;
- work retained by the coordinator;
- which applicable shared resources remain centralized and their authoritative owners;
- lanes that are blocked or queued; and
- whether additional workers will start when capacity opens.

The coordinator explicitly retains accountability for the original user requirements, decomposition, dependency tracking, conflict prevention, major decisions, contradiction resolution, integration, final validation, final response, Git integration, and repository synchronization. Launching workers never transfers accountability for the final result.

#### Grouping and meaningful status-change triggers

Group workers launched or completed at approximately the same time into one structured update. Do not send one nearly identical message per worker. Send a new grouped or individual update only when something meaningful changes, including:

- a worker launches or a new wave begins;
- ownership, objective, permissions, dependencies, or end goal materially changes;
- a worker becomes blocked, fails, or reports a major finding;
- a worker completes, is replaced, is cancelled as redundant, or releases its slot;
- ownership transfers; or
- integration begins or materially changes state.

Later workers require their own clearly labeled manifest, such as `Subagent wave 2 started`, `Additional verification lanes started`, or `Replacement lane started`; an earlier manifest never covers newly created workers.

#### Completion-report format

When one or more workers finish at approximately the same time, report their results in a compact card or table. For every completed lane, state:

- lane ID and role;
- completion status and deliverable received;
- major finding or authorized change;
- focused validation performed;
- unresolved uncertainty;
- whether the coordinator has reviewed the output; whether it is awaiting integration, integrated, or independently verified; and
- confirmation that the worker slot was released.

Worker-reported completion is not coordinator verification. Preserve the distinction among worker complete, output reviewed, output integrated, and output independently verified in both the chat update and workstream matrix.

#### Blocker, failure, replacement, and cancellation format

For a blocked or failed worker, disclose the lane ID, exact blocker or failure, useful partial work preserved, ownership or resource locks released, impact on dependent lanes, confirmation that unrelated lanes continue when applicable, recovery action, and whether the lane will be retried, narrowed, split, reassigned, serialized, replaced, or cancelled.

Do not hide a failed or blocked lane because other lanes succeeded.

For a replacement lane, announce the replacement with a new or clearly related lane identity, its complete launch manifest, what prompted the replacement, preserved partial evidence, and the remaining responsibility transferred to it.

For a lane cancelled as redundant or no longer necessary, disclose why it became redundant, useful output preserved, the lane that now owns remaining responsibility, the released slot or resource, and confirmation that no unreviewed material result was discarded.

#### Scope and ownership-change format

Before a worker continues under revised ownership, objective, permissions, dependencies, or end goal, announce:

- the previous scope and new scope;
- the reason for the change;
- whether ownership conflicts were checked;
- the other lanes or authoritative resource owners affected; and
- whether the dependency graph, workstream matrix, file/resource ownership plan, or another plan section was updated.

Workers may not silently broaden their scope. A write-ownership transfer stops the prior writer, records the handoff condition and evidence, updates the one-writer record, and announces the transfer before the new writer edits.

#### Anti-spam and reasoning boundary

Do not require or send updates for every tool call, file opened, search, minor internal observation, unchanged poll, or the mere passage of time. Do not repeat `still working` messages without a meaningful topology, ownership, status, finding, dependency, or integration change. Do not expose or request private chain-of-thought, raw internal reasoning, unfiltered worker logs, or full worker prompts unless the user explicitly requests the prompt text. Visible updates provide decisions, scope, evidence, results, and concise rationale sufficient for the user to understand and audit the parallel work.

Communication supports execution and must not materially slow it. Use compact grouped manifests, concise meaningful status changes, and no duplicate narration. Continue independent work while preparing nonblocking updates, and never turn the disclosure requirement into unnecessary scheduling ceremony.

#### Final parallel-execution summary

For every substantial task that used subagents, the final response must concisely summarize:

- total unique subagents used, maximum simultaneous workers, and worker waves;
- roles and ownership boundaries, including which lanes were read-only and which modified files;
- important results from each lane;
- failed, blocked, replaced, or cancelled lanes and the disposition of partial work;
- how outputs, contradictions, overlaps, and handoffs were reconciled;
- whether parallelization increased useful capacity or throughput, technical depth, coverage, verification confidence, or reduced elapsed time; and
- avoidable duplication or coordination overhead observed and improvements for the next decomposition.

Keep the summary evidence-based and readable. Do not reproduce raw worker prompts or private reasoning, and do not invent numerical performance percentages when timing or work data was not recorded.

### 12. Subagent briefing template

Use a bounded briefing such as:

```text
Lane ID and role:
Visible worker name:
Chat announcement status:
User-visible objective:
Objective:
Background and governing requirements:
Scope:
Explicit non-scope:
Authorization: read-only | write
Owned concerns/paths:
Verified existing-file ownership (exact canonical repository paths and verification evidence):
Intentional new-file ownership (exact canonical repository paths; creation confirmed):
Unresolved paths (lane remains read-only):
Forbidden resources and paths:
Dependencies and prerequisite evidence:
Constraints and invariants:
End goal:
Capacity benefit:
Quality or coverage benefit:
Elapsed-time benefit:
Critical-path relationship:
Earliest safe start:
Expected blocking dependencies:
Can integration begin before other lanes finish?
Reassignment or split trigger:
Why this lane should run independently:
Expected coordinator integration cost:
Worker capability and reasoning requirement:
Required repository-wide searches or checks:
Required deliverable:
Required evidence (paths, symbols, commands, reproduction, confidence):
Focused validation:
Return format (inspected, findings, paths/symbols, evidence, changes, tests, failures, uncertainty, overlaps/conflicts, recommendations, confidence, completion status):
Completion criteria:
Completion announcement status:
Coordinator integration path and current status:
Stop conditions:
Blocker/uncertainty/overlap/ownership-conflict reporting:
```

Briefings must carry the requirements the worker needs; do not rely on the worker to reconstruct user intent. Require distilled results, not full raw logs. A worker must stop and report if its scope becomes ambiguous, overlaps another writer, requires a prohibited shared resource, or would broaden the task.

### 13. Shared-resource and locking plan

| Resource                             | Authoritative owner | Other permitted consumers            | Exclusive operations                        | Conflict-prevention method                              | Release/handoff condition                   |
| ------------------------------------ | ------------------- | ------------------------------------ | ------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| Port `3000` and development server   |                     | Existing logs/HTTP evidence only     | Start/stop/restart                          | Inspect listener and recorded launcher state; one owner | Server stopped or ownership acknowledged    |
| Browser session                      |                     | Read-only observers if safe          | Stateful automation                         | Separate contexts or one controller                     | State/evidence saved                        |
| Database and seed state              |                     | Read-only queries if explicitly safe | Mutation/reset/seed/migration               | One database owner; back up when required               | State and evidence recorded                 |
| Prisma schemas and migrations        |                     | Read-only review                     | Schema edit, migration creation/application | One authoritative writer; preserve order                | Schema/migration validated and handed off   |
| `package.json` / `package-lock.json` |                     | Read-only review                     | Dependency install/regeneration             | One package owner                                       | Lockfile diff reviewed                      |
| Global styles / layout / providers   |                     | Read-only review                     | Shared interface edits                      | One integration owner                                   | Consumers reconciled                        |
| Route definitions                    |                     | Read-only inventory                  | Conflicting route/layout edits              | Path owner plus integration review                      | Route map validated                         |
| Generated assets                     |                     | Consumers of existing output         | Regeneration                                | One generator, deterministic inputs                     | Output and provenance reviewed              |
| Full E2E/build/validation            |                     | Consumers of reports                 | Expensive full run                          | One validation owner                                    | Results saved and reviewed                  |
| Deployment environment               |                     | Read-only status consumers           | Deploy/rollback/config mutation             | Explicit authority and one operator                     | Health and rollback state confirmed         |
| Chat/document synchronization        | Coordinator         | Workers provide summaries only       | Dry-run/live/validate/commit/push           | Run once after lanes finish                             | Structured report and remote state verified |

Add task-specific resources. In this repository, normal development uses `npm run dev:full` on `127.0.0.1:3000`. The Playwright default test port (`3100`) and validation production proof port (`3200`) are isolated validation resources, not extra canonical app instances.

### 14. File ownership plan

Record:

- one writer per file at a time;
- exact canonical repository paths for every assigned existing file, verified against the current repository before writer launch;
- explicit **verified existing-file ownership**, **intentional new-file ownership**, or **unresolved path — read-only** classification for every assigned path;
- confirmation that each nonexistent path is either an intended new file or remains unresolved and cannot receive write authorization;
- path/component/package boundaries for every write lane, without using a broad boundary as a substitute for verifying assigned existing files;
- the integration owner for shared files;
- read-only reviewers assigned where edit overlap would otherwise occur;
- worktree locations or isolation method for independent implementation lanes;
- pre-existing files that no lane may stage, overwrite, or normalize;
- ownership handoff order and evidence; and
- the rule for newly discovered shared files.

Recommended table:

| Exact canonical repository path or verified outer pattern | Path classification | Verification evidence | Writer/owner | Read-only reviewers | Ownership window | Dependencies | Handoff condition |
| --------------------------------------------------------- | ------------------- | --------------------- | ------------ | ------------------- | ---------------- | ------------ | ----------------- |
|                                                           |                     |                       |              |                     |                  |              |                   |

Do not launch a write-enabled lane until all of its assigned paths are classified and verified. If any path remains unresolved, retain read-only authorization, continue safe discovery, and update both this ownership plan and the visible worker manifest before granting write access.

Package manifests and lockfiles, Prisma schemas/migrations/seed, root layouts and providers, global styles/tokens, route entrypoints, central registries, runtime configuration, and generated files are presumed conflict-prone until inspected. Exactly one integration lane owns each such resource.

### 15. Runtime strategy

Define:

- who may start and stop the application;
- the exact verified command;
- how canonical port `3000` ownership is checked and maintained;
- whether an already-running instance can be reused;
- how other lanes request runtime evidence without starting duplicates;
- how browser testing is divided and state isolated;
- where server logs and screenshots are stored or referenced;
- how stale or unknown processes are detected and handled safely; and
- when runtime validation occurs relative to integration.

Repository defaults:

- use `npm run dev:full` and `npm run dev:stop` for the normal development lifecycle;
- never kill an unknown listener merely to acquire port `3000`;
- do not let workers run competing servers;
- use Playwright's configured isolated server for E2E ownership, not the shared development server, unless the plan explicitly proves a safe alternative;
- treat database-mutating browser work as exclusive unless separate databases are configured; and
- centralize final browser/runtime review after integration.

### 16. Testing strategy

Plan all applicable layers:

| Layer                 | Owner | Focused or integrated | Parallelizable shards    | Serialized resource      | Required evidence | Pass/fail treatment |
| --------------------- | ----- | --------------------- | ------------------------ | ------------------------ | ----------------- | ------------------- |
| Format/lint/type      |       |                       |                          |                          |                   |                     |
| Unit/component        |       |                       |                          |                          |                   |                     |
| Asset/contracts       |       |                       |                          |                          |                   |                     |
| Integration/API       |       |                       |                          | Database/runtime if used |                   |                     |
| E2E/accessibility     |       |                       |                          | Server/browser/database  |                   |                     |
| Production build      |       | Integrated            | No duplicate full builds | Build cache/output       |                   |                     |
| Performance           |       |                       |                          | Target runtime           |                   |                     |
| Regression/acceptance |       | Integrated            |                          | Full gate                |                   |                     |

Use only verified commands. Available focused commands include `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run assets:validate`, `npm run test:e2e`, and `npm run build`. `npm run validate` is the full cross-cutting gate. No separate `test:integration` script is currently verified; describe the actual focused Vitest/Playwright coverage instead of inventing one.

Implementation lanes run the smallest relevant focused checks, and safe independent test shards run concurrently. Test high-risk assumptions early enough to unblock or redirect critical-path work. One validation owner deduplicates full lint/type/build/browser/server work and runs the required integrated gate when the combined state is ready enough to make the result useful. Do not make each worker run a complete suite, duplicate a build without a demonstrated reason, or rerun expensive global checks after every small lane.

Reuse valid repository, test, server, and browser evidence when its state and provenance still apply. Classify failures immediately as pre-existing, task regression, environmental, intermittent, or unresolved so unaffected work can continue. Record commands, exit status, relevant counts, artifact paths, and failures; never erase failure evidence to make a gate appear clean. Speed never authorizes silently skipping required validation.

### 17. Integration strategy

Define:

- integration owner;
- lane handoff and merge order based on dependencies;
- shared-file update owner and timing;
- conflict-resolution process;
- how duplicated or competing changes are detected;
- how cross-lane assumptions and interfaces are checked;
- how the complete integrated diff and working tree are reviewed; and
- focused and cross-cutting checks to run after integration.

Review critical results promptly and begin synthesis, implementation, or integration from sufficiently verified completed lanes. Integrate completed independent work in safe increments and keep unrelated lanes running; do not wait for every lane when unresolved results do not block the next step. Record unresolved dependencies explicitly, and surface major findings early enough to change downstream scheduling. A completed result must not sit unused merely because unrelated workers remain active.

The integration owner preserves both sides of unexpected conflicts, consults the governing source, and resolves only when intent is clear. Workers do not casually merge, stage, or overwrite one another's work. Final Git reconciliation, if authorized, remains serialized.

### 18. Risk register

| Risk ID | Description | Probability  | Impact       | Detection method | Mitigation | Owner | Recovery action | Status |
| ------- | ----------- | ------------ | ------------ | ---------------- | ---------- | ----- | --------------- | ------ |
| K1      |             | Low/Med/High | Low/Med/High |                  |            |       |                 | Open   |

Include ownership collision, stale repository assumptions, accidental scope expansion, runtime/port/database contention, migration ordering, generated-file churn, pre-existing failures, security/privacy exposure, incomplete integration, and validation gaps where applicable.

### 19. Decision log

| Decision ID | Decision | Reason | Alternatives considered | Evidence | Affected lanes | Date/stage |
| ----------- | -------- | ------ | ----------------------- | -------- | -------------- | ---------- |
| D1          |          |        |                         |          |                |            |

Record concise rationale and evidence, not private chain-of-thought.

### 20. Discovery log

| Discovery ID | Finding | Evidence | Changes scope/dependencies/ownership/validation/risk | Plan update | Date/stage |
| ------------ | ------- | -------- | ---------------------------------------------------- | ----------- | ---------- |
| X1           |         |          |                                                      |             |            |

Log discoveries that materially change architecture assumptions, canonical locations, dependency edges, ownership, validation, risk, or completion criteria.

### 21. Progress tracking

Use these statuses consistently:

- **Not ready** - prerequisites are unresolved.
- **Ready** - prerequisites are satisfied and ownership is available.
- **Active** - work is currently running.
- **Blocked** - a specific blocker prevents progress.
- **Failed** - the lane stopped unsuccessfully; preserve partial evidence, release ownership/resources, and record the recovery disposition.
- **Awaiting integration** - lane deliverable is complete but not yet reconciled.
- **Integrated** - combined into the coordinator's working state.
- **Verified** - required focused and integrated checks passed or were accounted for.
- **Complete** - acceptance criteria and reporting are finished.
- **Replaced** - a disclosed replacement lane owns the remaining responsibility and preserved partial evidence.
- **Cancelled as redundant** - lane is no longer necessary and useful partial evidence is preserved.

Plans reflect actual state, not optimistic expectations. At most one owner writes a file or holds an exclusive resource at a time.

### 22. Failure recovery

For each material lane or shared resource, define:

- how partial results are preserved;
- retry limit or retry condition;
- when to narrow, split, or reassign a lane;
- when an initially parallel lane must be serialized;
- which dependent lanes become blocked;
- which unaffected lanes continue;
- how ownership and runtime locks are released;
- recovery or rollback action for mutations; and
- when user intervention is genuinely required.

Do not restart completed work because another lane failed. A failed lane returns partial evidence and a precise blocker. The coordinator discloses any gap that remains material to completion.

### 23. Final verification

Before claiming completion:

- re-read the original user request and governing sources;
- map every acceptance criterion to a delivered change or verified result;
- reconcile every lane output and resolve or disclose contradictions;
- confirm no material agent result remains unreviewed;
- inspect the complete integrated diff and working tree for accidental scope expansion;
- verify shared-file ownership and handoffs are complete;
- run required focused, integrated, runtime, regression, accessibility, performance, security, migration, build, or acceptance checks as applicable;
- distinguish skipped, unverified, pre-existing, and failed checks;
- confirm generated artifacts and unrelated work were not accidentally staged or treated as source; and
- run the single coordinator-owned repository finalization gate from `AGENTS.md`.

For documentation-only work, use proportionate document validation and do not launch the application or full test suite unless a governing instruction explicitly requires it.

### 24. Final report format

The coordinator reports:

```text
Outcome: what was completed
Parallel execution: lanes, modes, ownership boundaries, waves, maximum concurrency, and why the decomposition was safe/useful
Subagent lifecycle: total unique workers; important results; failed, blocked, replaced, or cancelled lanes; and reconciliation/integration status
Parallel execution outcome for substantial tasks: effect on throughput, capacity, depth/coverage, verification, elapsed time, duplication/overhead, and improvements for the next decomposition
Affected files/systems: task-authored changes, sync-owned changes, and pre-existing work classified separately
Validation: commands/checks, exit status, and material evidence
Failures/limitations: unresolved or skipped checks and why
Remaining risks: known risks that remain within or outside scope
Follow-up: only work genuinely outside the requested scope
Chat archive: required synchronization result
Development docs: required synchronization result
```

For every substantial task that used subagents, include the complete final parallel-execution summary required by the communication plan: total unique subagents, maximum simultaneous workers, waves, roles and ownership boundaries, read-only and write-enabled lanes, important results from each lane, failures/blocks/replacements/cancellations, reconciliation, realized capacity/depth/coverage/verification/time benefits, avoidable duplication or overhead, and decomposition improvements. Keep the assessment concise and evidence-based. Do not claim speculative numerical percentages unless timing or work data was actually recorded.

For every substantial task, the final execution assessment must also state concisely and from observed task evidence:

- whether independent work began promptly;
- whether useful capacity remained unnecessarily idle;
- whether critical-path work received priority;
- whether completed results were reviewed and integrated promptly;
- whether parallelization materially reduced elapsed time;
- what avoidable waiting, duplication, or planning overhead occurred; and
- how a similar future task could finish faster.

Do not invent timing figures, duration estimates, or percentages that were not measured.

The report provides concise rationale, evidence, decisions, and results. It does not expose private chain-of-thought or paste raw agent logs.

## Standard parallel workflow patterns

Adapt these patterns to the task rather than copying them mechanically.

### Repository-wide audit

Typical lanes include repository/architecture census, one or more subsystem reviews, runtime behavior, performance, accessibility, security, testing, data integrity, documentation consistency, missing opportunities, evidence verification, and final reconciliation. Target six to twelve workers when that many real categories exist. Preserve the audit prompt, taxonomy, severity definitions, evidence rules, and report format; give each lane a bounded evidence surface; verify severe/disputed findings; and centralize deduplication, severity reconciliation, and the final coherent audit.

### Multi-feature implementation

1. Establish shared architecture/contracts and identify shared files.
2. Place genuinely independent feature lanes in separate worktrees or assign disjoint paths.
3. Give shared architecture, schemas, configuration, manifests, and lockfiles one owner.
4. Let each feature lane run focused tests.
5. Integrate in dependency order under one owner.
6. Run final full-system verification once on the combined state.

### Bug investigation

Potential lanes include independent reproduction, static code tracing, runtime tracing, regression history, test-gap analysis, platform-specific behavior, dependency behavior, and alternative-hypothesis verification. Keep hypotheses distinct and evidence-backed. The coordinator reconciles them and selects a supported root cause before authorizing implementation. Parallel fixes for the same suspected defect are normally redundant unless intentionally comparing isolated approaches.

### Refactor

Start architecture mapping, consumer inventory, and test-baseline lanes in parallel. Serialize shared-interface changes under one owner, then fan out independent package/component migrations with disjoint ownership. Integrate in dependency order and run compatibility/regression verification after all consumers move.

### Frontend experience work

Potential lanes include route/shell structure, navigation, bounded component groups, animation/interaction, design-system consistency, responsive behavior, accessibility, performance, browser reproduction, test coverage, visual verification, and integration review. Use up to twelve when these are genuinely independent. Assign one owner to root layout, providers, shared tokens/global styles, and route shells, plus one runtime/browser owner. Finish with an integrated responsive, keyboard, motion-mode, console, performance, and UX review against the original acceptance criteria.

### Backend or database work

Potential lanes include API, services, repositories, schema analysis, data integrity, security, tests, operational readiness, observability, and documentation. Separate them only where evidence or files do not overlap. Give schemas and the ordered migration chain one authoritative writer and one database/migration operator. Serialize migration generation/application and shared state mutation. Integrate API/service contracts before final database, security, regression, and deployment-readiness validation.

### Documentation task

Potential lanes include source inventory, contradiction review, terminology, factual verification, structural review, instruction-discovery validation, configuration validation, and editorial integration. Fan out read-only discovery and fact-checking by topic. Topic-specific drafting may run in parallel only with disjoint document ownership. Use one editorial integration owner for shared documents, terminology, links, and final formatting. Verify claims against sources and run proportionate diff/format/link checks. Do not create extra helper documents when the requested output is fixed.

### Homogeneous batch investigations

When the installed client exposes `spawn_agents_on_csv` or a verified equivalent, optional batch fan-out may handle many independent items with the same analysis: one component, route, package, animation system, test failure, migration target, document, or incident per row. Treat this capability as client-surface dependent and experimental; use ordinary named lanes when clearer.

Each batch requires a stable item ID, explicit input columns, fixed output schema, scope and non-scope, evidence fields, confidence, exactly one result per worker, bounded runtime, maximum safe concurrency, consolidated output, coordinator reconciliation, and retained error rows. Never silently drop failures or assume a batch tool exists without verifying the current client.

## Anti-patterns

Do not:

- process independent areas sequentially without a concrete reason;
- leave useful worker slots idle while ready meaningful work exists;
- wait for an entire worker wave when one slot becomes available;
- wait for every discovery lane before starting implementation that has sufficient verified inputs;
- wait for every implementation lane before integrating completed independent work when incremental integration is safe;
- require every worker to finish before reviewing completed high-priority output;
- spawn agents with substantially identical scopes;
- make every agent scan the entire repository;
- make every worker rediscover repository structure instead of reusing a shared census;
- delay safe read-only fan-out until every planning field is complete;
- write oversized plans or status reports whose coordination cost exceeds their practical value;
- perform delegable work in the coordinator merely because delegation requires a briefing;
- launch work before evidence, path, and resource ownership are defined;
- launch a write-enabled worker against an unresolved, inferred, shorthand, or otherwise unverified path;
- treat a nonexistent path as writable without explicitly confirming and labeling intentional new-file ownership;
- allow multiple agents to edit the same file concurrently;
- let multiple development servers compete for port `3000`;
- make every lane run the entire test suite;
- rerun expensive global checks after every small lane instead of using focused checks and one integrated gate;
- use agent count as a quality metric or create microscopic artificial lanes;
- maintain redundant lanes after sufficient evidence exists;
- ignore slower-lane results because faster lanes finished first;
- combine reports without reconciling duplicates, severity, or contradictions;
- let subagents reinterpret or broaden user requirements;
- use parallelism to bypass safety, review, authorization, or validation;
- restart completed work after one lane fails;
- claim completion before integration and verification;
- create alternate application copies, port-specific versions, or abandoned variants;
- use generated snapshots or obsolete/source-history trees because they are easier to discover;
- hide uncertainty, partial failure, skipped validation, or incomplete integration;
- let workers independently fetch/rebase/merge/commit/push or run chat/document synchronization without explicit exclusive ownership; or
- stage the whole repository by default in a dirty worktree.

## Adaptive plan behavior

Update the plan when:

- new dependencies or shared resources are discovered;
- two lanes overlap or shared-file conflict becomes likely;
- a lane becomes unnecessary or duplicates another;
- supposedly independent work is found to be dependent;
- a blocked lane can be narrowed or split;
- a slow or broad lane can be split or reassigned to shorten the critical path without losing useful work;
- additional safe parallelism becomes available;
- runtime evidence contradicts static analysis;
- the canonical implementation differs from the initial assumption;
- a write-lane path is verified, found nonexistent, confirmed as an intentional new file, or remains unresolved;
- validation reveals a pre-existing failure or regression; or
- risk, completion criteria, or user authority changes.

When adapting:

1. preserve completed work and useful partial evidence;
2. update dependency edges, ownership, locks, status, risk, and validation;
3. notify affected lanes and stop conflicting writers before reassignment;
4. record the material discovery or decision;
5. start newly ready independent work promptly;
6. review and integrate completed high-priority output without waiting for unrelated lanes; and
7. avoid unnecessary restarts.

The plan serves the task. It may evolve, but it may never override the user's instructions or governing product requirements. Codex must move as quickly as possible without becoming careless: progressive planning, specialization, early risk resolution, incremental integration, focused validation, and prompt worker reuse exist to deliver a correct and complete result in the least practical elapsed time.
