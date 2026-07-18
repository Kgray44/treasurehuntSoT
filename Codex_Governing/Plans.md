# Repository execution-planning standard

This document defines how Codex plans and coordinates nontrivial work in this repository. It is a reusable execution standard, not a plan for one feature or audit. `AGENTS.md` supplies the governing behavior and instruction hierarchy; current user instructions and governing product documents continue to define scope and desired results.

Root `PLANS.md` does not replace `Development_Docs`. When a task requires a durable authored plan or implementation record, store that task-specific artifact under `Development_Docs` in accordance with its rules. A plan may otherwise remain in the task's coordination state or in the user-requested artifact.

## When an execution plan is required

Use this planning structure for work that is any of the following:

- multi-step, cross-cutting, ambiguous, long-running, repository-wide, or high-risk;
- spread across multiple subsystems or suitable for multiple subagents;
- dependent on staged validation or likely to modify shared infrastructure;
- an audit, feature, refactor, bug investigation, test initiative, documentation effort, architecture change, data migration, deployment preparation, performance effort, accessibility effort, or cross-system project; or
- large enough that context loss, duplicated work, ownership ambiguity, or accidental restart is plausible.

A trivial localized task may use a lightweight inline plan, but it must still respect ownership, repository safety, and finalization requirements.

## Planning principles

An execution plan must:

- be self-contained enough for another coordinator to continue without rediscovering the task;
- preserve the exact user goal, terminology, constraints, acceptance criteria, methodology, and output format;
- separate requirements and invariants from implementation choices;
- identify verified facts, assumptions, unknowns, and canonical sources;
- represent work as a dependency graph rather than a falsely linear checklist;
- maximize safe, useful concurrency while identifying conflict-prone and serialized work;
- establish one coordinator, clear lane ownership, and one writer per file at a time;
- identify shared runtime and expensive resources with authoritative owners;
- define evidence, focused validation, integration validation, and completion criteria before implementation;
- remain updateable as discoveries change scope, dependencies, ownership, risk, or validation;
- record significant decisions and discoveries without exposing private chain-of-thought; and
- preserve completed work when the plan changes.

## Required execution-plan template

Use the following sections. "Not applicable" is acceptable only with a short reason.

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

| ID | Assumption or unknown | Impact if wrong | Verification method | Responsible lane | Can work proceed first? | Status/evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A1 |  |  |  |  | Yes/No |  |

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

For a substantial task that remains primarily sequential, document the dependency, safety, exclusive-resource, or overlapping-file reason. Ease of coordination is not enough.

### 8. Dependency graph

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

### 9. Workstream matrix

| Lane ID | Lane name | Objective | Agent role | Read/write | Owned scope | Owned paths | Explicit non-scope | Dependencies | Shared resources | Deliverables | Required evidence | Focused validation | Status | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 |  |  |  | Read-only |  |  |  |  |  |  |  |  | Ready |  |

Every lane must have a non-overlapping evidence or edit boundary. If two write lanes need the same file, change the ownership or serialize the handoff before either edits.

### 10. Subagent briefing template

Use a bounded briefing such as:

```text
Objective:
Background and governing requirements:
Scope:
Explicit non-scope:
Authorization: read-only | write
Owned concerns/paths:
Resources and paths you must not modify:
Dependencies and prerequisite evidence:
Constraints and invariants:
Required repository-wide searches or checks:
Required deliverable:
Required evidence (paths, symbols, commands, reproduction, confidence):
Focused validation:
Return format (compact summary, changes, evidence, tests, blockers):
Completion criteria:
Stop conditions:
Blocker/uncertainty/ownership-conflict reporting:
```

Briefings must carry the requirements the worker needs; do not rely on the worker to reconstruct user intent. Require distilled results, not full raw logs. A worker must stop and report if its scope becomes ambiguous, overlaps another writer, requires a prohibited shared resource, or would broaden the task.

### 11. Shared-resource and locking plan

| Resource | Authoritative owner | Other permitted consumers | Exclusive operations | Conflict-prevention method | Release/handoff condition |
| --- | --- | --- | --- | --- | --- |
| Port `3000` and development server |  | Existing logs/HTTP evidence only | Start/stop/restart | Inspect listener and recorded launcher state; one owner | Server stopped or ownership acknowledged |
| Browser session |  | Read-only observers if safe | Stateful automation | Separate contexts or one controller | State/evidence saved |
| Database and seed state |  | Read-only queries if explicitly safe | Mutation/reset/seed/migration | One database owner; back up when required | State and evidence recorded |
| Prisma schemas and migrations |  | Read-only review | Schema edit, migration creation/application | One authoritative writer; preserve order | Schema/migration validated and handed off |
| `package.json` / `package-lock.json` |  | Read-only review | Dependency install/regeneration | One package owner | Lockfile diff reviewed |
| Global styles / layout / providers |  | Read-only review | Shared interface edits | One integration owner | Consumers reconciled |
| Route definitions |  | Read-only inventory | Conflicting route/layout edits | Path owner plus integration review | Route map validated |
| Generated assets |  | Consumers of existing output | Regeneration | One generator, deterministic inputs | Output and provenance reviewed |
| Full E2E/build/validation |  | Consumers of reports | Expensive full run | One validation owner | Results saved and reviewed |
| Deployment environment |  | Read-only status consumers | Deploy/rollback/config mutation | Explicit authority and one operator | Health and rollback state confirmed |
| Chat/document synchronization | Coordinator | Workers provide summaries only | Dry-run/live/validate/commit/push | Run once after lanes finish | Structured report and remote state verified |

Add task-specific resources. In this repository, normal development uses `npm run dev:full` on `127.0.0.1:3000`. The Playwright default test port (`3100`) and validation production proof port (`3200`) are isolated validation resources, not extra canonical app instances.

### 12. File ownership plan

Record:

- one writer per file at a time;
- path/component/package boundaries for every write lane;
- the integration owner for shared files;
- read-only reviewers assigned where edit overlap would otherwise occur;
- worktree locations or isolation method for independent implementation lanes;
- pre-existing files that no lane may stage, overwrite, or normalize;
- ownership handoff order and evidence; and
- the rule for newly discovered shared files.

Recommended table:

| Path or pattern | Writer/owner | Read-only reviewers | Ownership window | Dependencies | Handoff condition |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

Package manifests and lockfiles, Prisma schemas/migrations/seed, root layouts and providers, global styles/tokens, route entrypoints, central registries, runtime configuration, and generated files are presumed conflict-prone until inspected. Exactly one integration lane owns each such resource.

### 13. Runtime strategy

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

### 14. Testing strategy

Plan all applicable layers:

| Layer | Owner | Focused or integrated | Parallelizable shards | Serialized resource | Required evidence | Pass/fail treatment |
| --- | --- | --- | --- | --- | --- | --- |
| Format/lint/type |  |  |  |  |  |  |
| Unit/component |  |  |  |  |  |  |
| Asset/contracts |  |  |  |  |  |  |
| Integration/API |  |  |  | Database/runtime if used |  |  |
| E2E/accessibility |  |  |  | Server/browser/database |  |  |
| Production build |  | Integrated | No duplicate full builds | Build cache/output |  |  |
| Performance |  |  |  | Target runtime |  |  |
| Regression/acceptance |  | Integrated |  | Full gate |  |  |

Use only verified commands. Available focused commands include `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run assets:validate`, `npm run test:e2e`, and `npm run build`. `npm run validate` is the full cross-cutting gate. No separate `test:integration` script is currently verified; describe the actual focused Vitest/Playwright coverage instead of inventing one.

Implementation lanes run the smallest relevant checks. Independent unit shards may run concurrently. One validation owner deduplicates full lint/type/build/browser/server work and runs the required integrated gate on the combined state. Record commands, exit status, relevant counts, artifact paths, and failures. Classify failures as pre-existing, task regression, environmental, or unresolved with evidence; never erase failure evidence to make a gate appear clean.

### 15. Integration strategy

Define:

- integration owner;
- lane handoff and merge order based on dependencies;
- shared-file update owner and timing;
- conflict-resolution process;
- how duplicated or competing changes are detected;
- how cross-lane assumptions and interfaces are checked;
- how the complete integrated diff and working tree are reviewed; and
- focused and cross-cutting checks to run after integration.

The integration owner preserves both sides of unexpected conflicts, consults the governing source, and resolves only when intent is clear. Workers do not casually merge, stage, or overwrite one another's work. Final Git reconciliation, if authorized, remains serialized.

### 16. Risk register

| Risk ID | Description | Probability | Impact | Detection method | Mitigation | Owner | Recovery action | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 |  | Low/Med/High | Low/Med/High |  |  |  |  | Open |

Include ownership collision, stale repository assumptions, accidental scope expansion, runtime/port/database contention, migration ordering, generated-file churn, pre-existing failures, security/privacy exposure, incomplete integration, and validation gaps where applicable.

### 17. Decision log

| Decision ID | Decision | Reason | Alternatives considered | Evidence | Affected lanes | Date/stage |
| --- | --- | --- | --- | --- | --- | --- |
| D1 |  |  |  |  |  |  |

Record concise rationale and evidence, not private chain-of-thought.

### 18. Discovery log

| Discovery ID | Finding | Evidence | Changes scope/dependencies/ownership/validation/risk | Plan update | Date/stage |
| --- | --- | --- | --- | --- | --- |
| X1 |  |  |  |  |  |

Log discoveries that materially change architecture assumptions, canonical locations, dependency edges, ownership, validation, risk, or completion criteria.

### 19. Progress tracking

Use these statuses consistently:

- **Not ready** - prerequisites are unresolved.
- **Ready** - prerequisites are satisfied and ownership is available.
- **Active** - work is currently running.
- **Blocked** - a specific blocker prevents progress.
- **Awaiting integration** - lane deliverable is complete but not yet reconciled.
- **Integrated** - combined into the coordinator's working state.
- **Verified** - required focused and integrated checks passed or were accounted for.
- **Complete** - acceptance criteria and reporting are finished.
- **Cancelled as redundant** - lane is no longer necessary and useful partial evidence is preserved.

Plans reflect actual state, not optimistic expectations. At most one owner writes a file or holds an exclusive resource at a time.

### 20. Failure recovery

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

### 21. Final verification

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

### 22. Final report format

The coordinator reports:

```text
Outcome: what was completed
Parallel execution: lanes used and why the decomposition was safe/useful
Affected files/systems: task-authored changes, sync-owned changes, and pre-existing work classified separately
Validation: commands/checks, exit status, and material evidence
Failures/limitations: unresolved or skipped checks and why
Remaining risks: known risks that remain within or outside scope
Follow-up: only work genuinely outside the requested scope
Chat archive: required synchronization result
Development docs: required synchronization result
```

The report provides concise rationale, evidence, decisions, and results. It does not expose private chain-of-thought or paste raw agent logs.

## Standard parallel workflow patterns

Adapt these patterns to the task rather than copying them mechanically.

### Repository-wide audit

1. Coordinator preserves the audit prompt, taxonomy, severity definitions, evidence rules, and report format.
2. Fan out read-only lanes by subsystem and/or distinct concern.
3. Give each lane a bounded evidence surface and require paths, symbols, reproduction evidence, and confidence.
4. Use a dedicated verification lane or coordinator pass for severe, disputed, or uncertain findings.
5. Fan in through centralized deduplication, severity reconciliation, and contradiction resolution.
6. Produce one coherent audit; do not paste lane reports together.

### Multi-feature implementation

1. Establish shared architecture/contracts and identify shared files.
2. Place genuinely independent feature lanes in separate worktrees or assign disjoint paths.
3. Give shared architecture, schemas, configuration, manifests, and lockfiles one owner.
4. Let each feature lane run focused tests.
5. Integrate in dependency order under one owner.
6. Run final full-system verification once on the combined state.

### Bug investigation

Fan out read-only lanes for reproduction, code-path tracing, recent-change/regression analysis, and test-gap analysis. Keep hypotheses distinct and evidence-backed. The coordinator reconciles them and selects a supported root cause before authorizing implementation. Parallel fixes for the same suspected defect are normally redundant unless intentionally comparing isolated approaches.

### Refactor

Start architecture mapping, consumer inventory, and test-baseline lanes in parallel. Serialize shared-interface changes under one owner, then fan out independent package/component migrations with disjoint ownership. Integrate in dependency order and run compatibility/regression verification after all consumers move.

### Frontend experience work

Use bounded component lanes plus independent design-system/visual-consistency, animation/interaction, accessibility, and performance review lanes when separable. Assign one owner to root layout, providers, shared tokens/global styles, and route shells. Assign one runtime/browser owner. Finish with an integrated responsive, keyboard, motion-mode, console, performance, and UX review against the original acceptance criteria.

### Backend or database work

Separate API, repository/service, schema-analysis, test, and operational-readiness lanes where their evidence or files do not overlap. Give schemas and the ordered migration chain one authoritative writer and one database/migration operator. Serialize migration generation/application and shared state mutation. Integrate API/service contracts before final database, security, regression, and deployment-readiness validation.

### Documentation task

Fan out read-only source discovery and fact-checking by topic. Topic-specific drafting may run in parallel only with disjoint document ownership. Use one editorial integration owner for shared documents, terminology, links, and final formatting. Verify claims against sources and run diff/format/link checks proportionate to the task. Do not create extra helper documents when the requested output is fixed.

## Anti-patterns

Do not:

- process independent areas sequentially without a concrete reason;
- spawn agents with substantially identical scopes;
- make every agent scan the entire repository;
- launch work before evidence, path, and resource ownership are defined;
- allow multiple agents to edit the same file concurrently;
- let multiple development servers compete for port `3000`;
- make every lane run the entire test suite;
- use agent count as a quality metric or create microscopic artificial lanes;
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
- additional safe parallelism becomes available;
- runtime evidence contradicts static analysis;
- the canonical implementation differs from the initial assumption;
- validation reveals a pre-existing failure or regression; or
- risk, completion criteria, or user authority changes.

When adapting:

1. preserve completed work and useful partial evidence;
2. update dependency edges, ownership, locks, status, risk, and validation;
3. notify affected lanes and stop conflicting writers before reassignment;
4. record the material discovery or decision;
5. start newly ready independent work promptly; and
6. avoid unnecessary restarts.

The plan serves the task. It may evolve, but it may never override the user's instructions or governing product requirements.
