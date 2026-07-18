# Repository instructions

## Purpose and instruction hierarchy

This file governs repository-wide Codex behavior. New Codex runs launched inside this Git repository automatically discover the applicable root `AGENTS.md`. Root `AGENTS.md` requires reading root `PLANS.md` when a task meets its planning threshold; `PLANS.md` is a referenced planning standard, not an independently discovered instruction file.

Codex builds its instruction and configuration chain when a run or interactive session starts. A session already active when `AGENTS.md`, `PLANS.md`, or `.codex/config.toml` changes may retain stale state. Existing sessions must explicitly reread the applicable Markdown files or restart; project configuration changes require a fresh session before they are guaranteed to apply. Updating these files never retroactively restarts, redirects, or changes an active task.

Apply instructions in this order:

1. The user's current task instructions define what must be done and the required result.
2. Governing project documents, especially approved material in `Development_Docs`, define product behavior, architecture, and domain requirements.
3. Root `AGENTS.md` defines persistent repository execution behavior.
4. Root `PLANS.md` defines the reusable planning and coordination method.
5. Applicable nested instructions may add local constraints. They must not silently weaken this repository baseline without a concrete safety, dependency, or conflict reason.
6. Parallelization controls how work is executed, not what the requested result means.

Parallelization may never broaden scope, remove an acceptance criterion, weaken evidence, validation, accessibility, performance, security, or quality requirements, or reinterpret product requirements merely to create independent lanes. Preserve every task-specific constraint, term, methodology, and output format. Correctness and user intent take priority over raw speed or worker count.

When governing instructions change during an existing task, preserve the original task instructions, all completed work, established terminology, current scope, acceptance criteria, evidence, decisions, modifications, validation, and requested deliverable. Apply the updated execution framework only to unfinished work. Do not restart, discard, or re-scope the task merely because the governing framework changed.

## Speed as a first-class operational priority

> Speed is a first-class operational priority. Codex must organize and execute work to minimize total elapsed completion time while preserving correctness, user intent, safety, required evidence, ownership discipline, and validation quality.

Speed is not merely a hoped-for result of parallelization. It is an explicit planning, scheduling, delegation, worker-capability and reasoning-routing, review, integration, and validation objective.

The governing optimization target, in priority order, is:

1. Correct and complete results.
2. Minimum practical elapsed completion time.
3. Maximum useful capacity, depth, coverage, and verification within that time.
4. Minimum avoidable duplication, waiting, ceremony, and coordination overhead.

Correctness and safety remain hard constraints. Within those constraints, Codex must choose the valid execution approach expected to finish sooner. Faster completion must never weaken user intent, required evidence, accessibility, security, performance analysis, ownership, testing, integration, acceptance criteria, or final verification.

> Codex must move as quickly as possible without becoming careless. Parallelization, specialization, progressive planning, early risk resolution, incremental integration, focused validation, and prompt worker reuse exist to deliver a correct and complete result in the least practical elapsed time.

## Purpose of parallel execution

Subagent parallelization exists to accomplish three primary goals:

### 1. Increase effective work capacity

Multiple independent workstreams should progress simultaneously so the task receives substantially more useful work per unit of elapsed time than one sequential agent could provide.

Subagents should absorb bounded investigation, implementation, testing, evidence collection, review, and verification work that would otherwise accumulate serially in the coordinator's queue.

### 2. Increase strength, depth, and coverage

Parallel specialists should provide stronger results than one general agent working alone by examining separate subsystems, concerns, hypotheses, evidence sources, risks, test surfaces, and implementation boundaries in greater depth.

Subagents must be used to improve:

- completeness;
- technical depth;
- fault detection;
- independent verification;
- cross-checking;
- domain specialization;
- test coverage;
- architectural review; and
- confidence in conclusions.

Parallelism must not merely divide the same amount of shallow work among more agents.

### 3. Reduce elapsed completion time

Genuinely independent work must begin concurrently so large tasks finish materially faster than a sequential approach.

The coordinator must minimize unnecessary waiting, keep available worker capacity filled with meaningful ready work, immediately launch newly unblocked lanes, and avoid performing delegable work sequentially.

> The success of parallelization is measured by increased useful throughput, improved result quality and coverage, and reduced elapsed completion time, while preserving correctness, safety, ownership, and integration quality.

The following principles govern how those outcomes are achieved:

- Parallel execution is not successful merely because many workers were spawned.
- Workers must generate useful work that advances the task.
- Parallelism must not add coordination overhead greater than the time or quality benefit it creates.
- The coordinator must avoid bottlenecking the system by personally performing work that could safely be delegated.
- The coordinator must review and integrate worker output promptly so completed lanes do not sit unused.
- Available worker slots should be kept occupied when meaningful ready work exists.
- Workers should be assigned substantial, outcome-oriented lanes rather than tiny ceremonial tasks.
- Independent verification lanes are valuable because they increase confidence and catch errors, even when they do not directly modify code.
- Specialization should be used deliberately so difficult areas receive appropriately capable reviewers or implementers.
- Faster completion must never come from reducing required evidence, testing, reasoning, accessibility, security, performance analysis, or acceptance criteria.
- Quality improvement must not become an excuse for unlimited duplicate investigation after sufficient evidence exists.
- Parallelization must optimize the combination of speed, capacity, depth, and correctness rather than maximizing any one metric alone.

## Visible subagent disclosure

Subagent use must never be invisible to the user. Whenever the coordinator creates, launches, changes, replaces, blocks, fails, cancels, completes, integrates, or verifies a subagent lane, it must provide a concise, structured, user-visible chat update at the time of that meaningful event. The update must make the current worker topology, ownership, expected outcome, and integration state understandable without exposing private chain-of-thought.

This requirement applies to one worker or many, including named specialists, full parallel sets, later waves, replacements, verification workers, read-only workers, implementation workers, test workers, and batch workers. Spawning workers never transfers accountability for the final result away from the coordinator.

### Required launch disclosure

Before or immediately after launching workers, publish a visible update titled `Subagents started`, `Subagent started`, or a similarly clear label. When several workers launch at approximately the same time, announce them together in one compact table rather than sending one repetitive message per worker. A launch manifest must disclose, for every lane:

- **Lane ID**;
- **subagent name or role**;
- **status**;
- **primary objective** and user-visible end goal;
- **why the lane exists**;
- **read-only or write-enabled mode**;
- **owned subsystem, concern, exact files, path patterns, components, packages, or evidence boundary**;
- **explicit non-scope and prohibited files, paths, systems, and resources**;
- **expected deliverable**;
- **completion criteria**;
- **dependencies and prerequisite evidence**;
- **shared resources it may not control**;
- **how the coordinator will review and integrate its output**; and
- **expected capacity, quality, coverage, verification, or elapsed-time benefit**.

For a multi-worker launch, use a compact structure equivalent to:

| Lane | Role            | Status | Mode      | Ownership                     | End goal and deliverable                | Non-scope                                | Dependencies         | Integration                                           | Expected benefit                     |
| ---- | --------------- | ------ | --------- | ----------------------------- | --------------------------------------- | ---------------------------------------- | -------------------- | ----------------------------------------------------- | ------------------------------------ |
| R1   | Route inventory | Active | Read-only | `src/app` route-tree evidence | Verified route and transition inventory | No edits, server, database, or Git state | Repository preflight | Coordinator cross-checks against other route evidence | Faster, more complete route coverage |

The launch update must also state:

- the total number of workers launched and the number of direct-worker slots still available;
- what work remains with the coordinator;
- which shared or expensive resources have one authoritative owner;
- which lanes are blocked or queued; and
- whether additional workers will start when capacity opens or dependencies clear.

When only one worker launches, disclosure remains mandatory. Use a compact card or structured block that provides the same information, for example:

> **Subagent started — V1: Runtime verification**
>
> - **Status:** Active
> - **Mode:** Read-only
> - **Owns:** Browser reproduction and runtime evidence
> - **Objective and end goal:** Confirm the reported transition defect and capture evidence
> - **Why this lane exists:** Independent runtime verification while static analysis continues
> - **Must not modify or control:** Application code, database, port ownership, or Git state
> - **Deliverable and completion:** Reproduction steps, affected routes, console evidence, and confidence after the defined checks complete
> - **Dependencies:** Existing runnable application state
> - **Integration:** Coordinator compares the runtime evidence with static findings
> - **Expected benefit:** Higher confidence without blocking implementation analysis

### Ownership and shared-resource transparency

The visible manifest must make write ownership unmistakable. For every write-enabled lane, identify the exact files, path patterns, components, or packages it may edit; the exact shared files it may not edit; whether it has an isolated worktree; its integration owner; and its handoff condition. It must distinguish **verified existing-file ownership**, **intentional new-file ownership**, and **unresolved paths that keep the lane read-only**. If ownership cannot be stated clearly, the worker remains read-only until the boundary is resolved and visibly announced. Exactly one agent may write a file at a time, and the existing exclusive-resource rules remain in force.

#### Write-lane path verification

Before launching any write-enabled subagent, the coordinator must verify every assigned existing file path against the current repository. Resolve each path from the current canonical repository root and use that exact canonical repository path in the assignment and visible manifest; shorthand, approximate names, inferred filenames, and unresolved path guesses are not valid write ownership.

For every assigned path that does not exist, the coordinator must determine whether the lane is intentionally authorized to create it. Label each such assignment explicitly as **intentional new-file ownership**, including its exact canonical destination path. Never launch a writer against an unresolved or unverified path. Until the path and ownership boundary are resolved, keep that lane read-only and label the path as unresolved in the visible manifest. Safe read-only discovery may continue concurrently while paths are being resolved; path verification must gate write authorization without delaying otherwise safe investigation.

Whenever applicable, the launch or ownership update must identify the authoritative owner of the development server, port `3000`, browser automation, database, schema, migrations, dependency installation, manifests, lockfiles, full build, full end-to-end suite, full validation, generated assets, Git integration, and final `Codex_Chats` / `Development_Docs` synchronization. Workers must not imply ownership of resources assigned elsewhere.

Every launch update must state that the coordinator retains the original user requirements, decomposition, dependency tracking, conflict prevention, major decisions, output review, integration, contradiction resolution, final validation, final response, and repository synchronization. The coordinator remains accountable for correctness and completion.

### Meaningful status changes and later waves

Provide a visible update when worker topology, ownership, permissions, objective, dependencies, findings, or integration state changes materially. Meaningful triggers include:

- worker launched or a new wave began;
- worker scope or ownership materially changed;
- ownership transferred;
- worker became blocked or failed;
- worker reported a major finding;
- worker completed;
- worker was replaced or cancelled as redundant; or
- integration, coordinator review, or independent verification began or completed.

If a lane's ownership, objective, permissions, dependencies, or end goal changes, announce the previous scope, new scope, reason, ownership-conflict check, effect on other lanes, and whether the plan was updated **before** allowing work to continue under the revised scope. Workers must never silently broaden their own scope.

Newly discovered lanes and later waves require a new manifest with the same information as the initial launch. Label it clearly, such as `Subagent wave 2 started`, `Additional verification lanes started`, or `Replacement lane started`; an earlier manifest never covers workers created later.

### Completion, blocking, failure, replacement, and cancellation

When a worker finishes, promptly provide a concise status update containing its lane ID and role, completion status, deliverable received, major finding or authorized change, validation performed, unresolved uncertainty, review and integration state, and confirmation that its worker slot was released. Group results received at approximately the same time into a compact table. Distinguish each state explicitly:

- **worker complete** means the lane returned its deliverable;
- **output reviewed** means the coordinator inspected that deliverable;
- **output integrated** means accepted changes or findings were incorporated into the combined result; and
- **output independently verified** means a separate check confirmed the material result.

A worker's completion report alone is not coordinator verification. A grouped completion report may use fields equivalent to:

| Lane | Result   | Key output                   | Validation                       | Uncertainty | Review / integration / verification                      | Slot     |
| ---- | -------- | ---------------------------- | -------------------------------- | ----------- | -------------------------------------------------------- | -------- |
| R1   | Complete | 24 active routes inventoried | Cross-checked against route tree | None        | Reviewed; awaiting synthesis; not independently verified | Released |

When a lane becomes blocked or fails, report its exact blocker, preserved partial work, released ownership or resource locks, impact on dependent lanes, whether unrelated lanes continue, recovery action, and whether the lane will be retried, narrowed, split, reassigned, serialized, replaced, or cancelled. Do not hide failure because other lanes succeeded.

When replacing a worker, report the prior lane's status and preserved output, why replacement is necessary, the replacement lane's complete launch manifest, ownership handoff, affected dependencies, and confirmation that no material result was lost or left unreviewed.

When cancelling a redundant or unnecessary lane, report its lane ID, why it became redundant, what useful output was preserved, which lane now owns any remaining responsibility, which locks or slots were released, and confirmation that no unreviewed material result was discarded.

### Grouping and anti-spam safeguard

Transparency must remain useful rather than noisy. Group workers launched or completed at approximately the same time into one structured update. Do not require or send updates for every tool call, file opened, search performed, minor internal observation, unchanged status poll, or passage of a few minutes. Do not repeat `still working` messages without a meaningful change, dump full worker prompts unless the user requests them, or expose raw internal reasoning or private chain-of-thought. Announce only meaningful changes in topology, ownership, permissions, status, material findings, dependencies, or integration state.

Required disclosure must occur immediately before or after launch through compact grouped manifests and concise meaningful status changes. Communication supports execution and must not become a blocking administrative process: do not delay safe workers merely to produce elaborate chat formatting, duplicate narration, full prompt dumps, or status reports with no new information.

### Final parallel-execution summary

For every substantial task that used subagents, the final response must concisely and readably summarize:

- total unique subagents used, maximum simultaneous workers, and worker waves;
- roles and ownership boundaries, including which lanes were read-only and which modified files;
- important results from each lane;
- failed, blocked, replaced, or cancelled lanes;
- how worker outputs were reviewed, reconciled, integrated, and verified;
- whether parallel execution increased capacity, depth, coverage, verification, or reduced elapsed time;
- any avoidable duplication or coordination overhead; and
- useful improvements for the next task decomposition.

Do not reproduce raw worker prompts or private reasoning. Keep the assessment evidence-based, and do not invent numerical percentages when timing or work data was not recorded.

## Mandatory parallelization assessment

Every task performs at least a brief parallelization assessment before substantial work begins. A concise internal determination is sufficient only for a genuinely trivial task with no useful independent lane.

The assessment identifies:

- genuinely independent workstreams and immediately ready read-only discovery;
- whether an independent verification lane improves quality;
- possible divisions by subsystem, concern, package, route, component family, evidence source, acceptance criterion, test surface, or implementation boundary;
- dependency edges, shared files, exclusive resources, and serialized work;
- the maximum safe and useful concurrency, worktree needs, integration owner, and final-validation owner.

If two or more genuine independent lanes exist, parallel delegation is mandatory unless a concrete technical, safety, dependency, resource, capacity, or ownership reason prevents it. The repository policy itself is standing authorization; the user does not need to request subagents, delegation, workers, parallel execution, or the full available limit.

## Critical-path and fast-start execution

Every Tier 1 and Tier 2 plan must identify the task's critical path and use it as an active scheduling input. The coordinator must:

- identify which work directly controls final completion time;
- launch critical-path work as early as safely possible;
- move prerequisite discovery off the critical path through parallel read-only lanes;
- prevent noncritical work from blocking critical work;
- resolve uncertain or high-risk dependencies early;
- begin integration incrementally when safe instead of waiting unnecessarily for every unrelated lane;
- start newly unblocked work immediately;
- reassign or split a slow lane when doing so can shorten completion time without discarding useful work or reducing quality;
- review and integrate completed worker output promptly rather than leaving it waiting; and
- prevent the coordinator from becoming the critical-path bottleneck.

When multiple valid decompositions exist, prefer the one expected to produce a correct integrated result sooner.

### Fast-start requirement

For every nontrivial task:

1. Complete the minimum safety and repository preflight.
2. Identify immediately ready independent lanes.
3. Publish the required subagent manifest.
4. Launch those lanes without unnecessary delay.
5. Continue refining the dependency graph and detailed plan while safe read-only work proceeds.
6. Launch write lanes as soon as ownership, requirements, and prerequisites are sufficiently established.
7. Keep capacity filled with the highest-value ready work.

The coordinator must not spend a large initial portion of the task only planning when useful bounded investigation can already proceed safely.

### No unnecessary waiting

Unless a real dependency, conflict, safety boundary, exclusive resource, or missing prerequisite requires serialization, do not:

- process independent workstreams sequentially;
- leave useful worker slots idle while ready work exists;
- wait for an entire worker wave when one slot becomes available;
- wait for every discovery lane before starting implementation that already has sufficient verified inputs;
- wait for every implementation lane before integrating completed independent work when incremental integration is safe;
- require every worker to finish before reviewing completed high-priority output;
- rerun expensive global checks after every small lane instead of using focused checks and one integrated gate;
- make every worker rediscover repository structure;
- delay safe read-only fan-out until every planning field is complete;
- write oversized plans or status reports whose coordination cost exceeds their practical value;
- perform delegable work in the coordinator merely because delegation requires a briefing; or
- maintain redundant lanes after sufficient evidence exists.

### Time-aware lane selection

In addition to capacity, quality, coverage, verification, and risk value, evaluate each proposed lane by asking:

- Will this lane reduce total elapsed completion time?
- Does it remove work from the critical path?
- Can it execute simultaneously with existing lanes?
- Will its expected time savings exceed briefing, monitoring, and integration overhead?
- Would combining it with another lane be faster?
- Would splitting a slow or broad lane shorten the critical path?
- Is the worker capability appropriate for the lane's urgency and complexity?
- Can the result be reviewed and integrated promptly?

A lane must not be created merely because parallel capacity exists. It should normally improve speed, capacity, quality, coverage, verification, or risk reduction enough to justify its overhead.

### Worker-slot utilization

- Meaningful ready worker capacity should normally remain fully utilized.
- For substantial tasks, maintain a queue of ready and next-ready lanes ordered by critical-path impact, value, risk, and dependency readiness.
- Fill each newly available slot immediately with the highest-value ready lane.
- Intentionally leave capacity unused only when no useful independent work exists or when conflict, dependency, safety, ownership, or resource constraints prevent more work.
- If substantial ready work exists but available capacity is intentionally unused, briefly record the concrete reason.

Do not require twelve workers when fewer meaningful lanes exist. Do require the full useful lane count when enough real, non-overlapping work exists.

## Aggressive concurrency requirement

Use the maximum safe and useful concurrency supported by the real dependency graph, available client capacity, file ownership boundaries, runtime constraints, and quality requirements.

- **One meaningful lane:** the coordinator may perform it directly. Add a verifier only when it contributes a distinct result. Do not manufacture delegation for a one-line mechanical task.
- **Two independent lanes:** start two workers concurrently unless a documented conflict prevents it. Do not finish one before starting the other.
- **Three to five independent lanes:** start every ready lane concurrently whenever capacity allows. Do not hold ready work merely to simplify coordination.
- **Six to twelve independent lanes:** use the full safe ready-lane count immediately when installed capacity permits. Large audits, investigations, cross-system reviews, multi-surface implementations, testing initiatives, and architecture analyses should normally use six to twelve direct workers when they naturally decompose that far. Twelve direct workers are explicitly acceptable, not required.
- **More than twelve independent lanes:** prioritize by dependency, criticality, uncertainty, and value; run waves; and fill each newly available slot immediately rather than waiting for a whole wave to finish.

Every worker must own a distinct subsystem, package, route group, component family, animation system, evidence source, bug hypothesis, acceptance criterion, test shard, review concern, risk category, document, non-overlapping file set, or verification responsibility. Never create duplicate prompts, duplicate full-repository scans without different purposes, microscopic artificial lanes, overlapping writers, or workers spawned only to reach twelve.

When a substantial task has materially more ready independent work than active workers, either fill safe capacity or record the concrete reason for under-utilization. "The coordinator can do it," sequential simplicity, prior low worker count, planning effort, or deferring ready work are not sufficient reasons. Unavailable thread capacity, overlapping writes, strict dependency, an exclusive runtime/database/migration/lockfile/generated artifact/browser state, undefined scope, destructive operations, security/authorization boundaries, or high duplication risk are valid reasons.

## Progressive fan-out

Verify the minimum safety baseline first: repository root, applicable instructions, user scope, working-tree state, existing task state, current modifications, exclusive resources, and destructive boundaries. Then launch obvious independent read-only lanes immediately while the coordinator refines the plan. Do not delay safe discovery until every planning table is complete. Do not start write lanes until ownership and integration boundaries are explicit and every assigned path has the required verified existing-file, intentional new-file, or unresolved read-only classification. Add newly discovered ready lanes dynamically, collapse redundant lanes, release unused capacity, and preserve useful partial findings.

## Canonical repository context

- The canonical Git repository is `Kgray44/treasurehuntSoT`; resolve its root dynamically with `git rev-parse --show-toplevel`. `main` is the canonical integrated branch. This repository is used across computers, so shared instructions must never assume a drive, username, home directory, parent directory, or checkout location.
- Root `AGENTS.md` is the canonical repository instruction file. Root `PLANS.md` is the canonical planning standard mandated by this file. Root `.codex/config.toml` is the trusted project configuration location. `Codex_Governing/Agents.md` and `Codex_Governing/Plans.md` are noncanonical retrieval mirrors and are never independent instruction sources.
- The canonical active application is the single Next.js App Router package at the repository root, named `forever-treasure-companion` and presented as the unified Tall Tale platform / Forever Treasure Companion. Do not treat snapshots, compatibility routes, validation copies, or former feature branches as alternate applications.
- Primary implementation locations are `src/app`, `src/components`, `src/animation`, `src/domain`, `src/lib`, `src/platform`, `src/server`, `src/tall-tale`, `prisma`, `public`, and `scripts`. Tests live beside source as `*.test.*` and under `tests/e2e`.
- `Development_Docs` is the canonical shared location for requirements, history, architecture, decisions, and authored plans. `docs` contains maintained product and engineering documentation. `Codex_Chats` is a conversation archive, not application source.
- No separate obsolete application tree is currently verified. Former feature branches are integrated history. The development-only `/dev/animations` route is not an obsolete application.
- Generated, local, archived, or excluded locations include `node_modules`, `.next`, `out`, `build`, `coverage`, `.runtime`, `.data`, `backups`, local database files, `test-results`, `playwright-report`, `playwright/.auth`, `artifacts/screenshots`, `artifacts/validation`, local logs, and Codex import/cache/temp content identified by `.gitignore`. Do not modify or cite these as canonical source. Instruction-looking files inside ignored validation snapshots, other worktrees, archives, or mirrors do not apply to the current checkout unless their own repository root/current-directory scope makes them applicable.

Verify the canonical implementation before broad exploration or modification. Do not create port-specific application copies, abandoned local variants, duplicate runtimes, or parallel implementations of existing canonical surfaces.

### Verified commands and ports

| Purpose                           | Verified command or behavior                       |
| --------------------------------- | -------------------------------------------------- |
| Canonical development start       | `npm run dev:full`                                 |
| Canonical development stop        | `npm run dev:stop`                                 |
| Canonical development address     | `http://127.0.0.1:3000`; port `3000` has one owner |
| Next-only development after setup | `npm run dev`                                      |
| Production build                  | `npm run build`                                    |
| Lint                              | `npm run lint`                                     |
| Format check                      | `npm run format:check`                             |
| Strict type check                 | `npm run typecheck`                                |
| Unit/component tests              | `npm test`                                         |
| End-to-end tests                  | `npm run test:e2e`                                 |
| Animation asset contracts         | `npm run assets:validate`                          |
| Full repository validation        | `npm run validate`                                 |

There is no separate verified `test:integration` script; integration behavior is covered by the focused Vitest/Playwright checks and the full `npm run validate` gate. Playwright normally owns an isolated server on port `3100`, and full validation normally uses port `3200` for production restart proof. Those are controlled validation resources, not authorization to start competing development servers. An explicitly isolated alternate development port is an exception for a demonstrated need, not a new application copy.

## Common parallelization triggers

The following commonly satisfy the mandatory two-lane threshold:

- multiple packages, services, subsystems, routes, pages, feature domains, or acceptance criteria;
- repository-wide audits, large codebase discovery, independent bug hypotheses, or multiple evidence sources;
- multiple animation libraries, renderers, or independent review categories;
- separable frontend, backend, database, API, deployment, documentation, test, accessibility, security, performance, functional, or maintainability concerns;
- broad refactors or implementations with non-overlapping ownership boundaries;
- independent test suites or validation surfaces; or
- noisy exploration that would displace requirements and integration state from the coordinator's context.

Broad read-heavy work strongly favors parallel specialist lanes.

## Work that normally remains serialized

Keep work sequential when delegation overhead exceeds the work or when ordering or exclusive ownership is material, including:

- tiny localized tasks;
- strictly dependent steps;
- changes concentrated in the same small group of files;
- ordered migration chains;
- package-manager, manifest, or lockfile updates with one authoritative writer;
- shared schema, configuration, entrypoint, route registry, global style, or central provider changes;
- destructive operations, production deployment, final integration, and final merges;
- one exclusive runtime, browser, database, or deployment resource; or
- any situation where parallel writes would create a race or ambiguous ownership.

For a substantial task performed primarily sequentially, record the concrete dependency, safety, resource, or conflict reason. Coordinator convenience alone is not sufficient.

## Coordinator responsibilities

The main agent is the coordinator. It must:

- retain the complete user request and governing constraints;
- perform or own repository/Git preflight, decompose the dependency graph, assign non-overlapping scopes, and prevent duplicate work;
- give every lane a bounded objective, authorization, ownership boundary, evidence requirement, validation requirement, completion condition, and return format;
- track dependencies, lane progress, available capacity, and shared resources while keeping raw logs and noisy exploration out of the main context;
- start replacement or newly ready lanes as soon as safe capacity becomes available;
- collect concise evidence-backed summaries, reconcile disagreements, and directly verify severe, risky, or uncertain findings;
- own shared-file integration, integrate in dependency order, review the combined diff, run final cross-cutting validation, and reread the original request before completion;
- produce one coherent final result rather than concatenating worker reports; and
- own the single mandatory `Codex_Chats` / `Development_Docs` finalization workflow unless it explicitly delegates that exclusive responsibility.

The coordinator's primary role is orchestration, requirements retention, decision-making, conflict resolution, integration, and final verification. It must not remain a general-purpose worker while safe meaningful work remains undelegated. Do not redo delegated work except for necessary verification. Workers must not fetch, pull, rebase, merge, commit, push, or run the synchronization workflow unless the coordinator explicitly grants that bounded authority.

## Subagent contract

Every delegated lane must state:

- lane ID, role, precise objective, relevant background, and governing requirements;
- explicit scope and non-scope;
- read-only or write authorization;
- owned files, directories, components, or concerns, plus forbidden paths and resources; for a write-enabled lane, use exact canonical repository paths and identify each as verified existing-file ownership or intentional new-file ownership;
- dependencies, prerequisite evidence, and shared resources it may not modify;
- required searches, output, evidence, focused validation, and confidence level;
- concise return schema covering what was inspected and found, paths/symbols, evidence, authorized changes, tests, failures, uncertainty, conflicts, recommendations, and completion status;
- completion and stop conditions; and
- instructions to report blockers, overlaps, partial results, uncertainty, and ownership conflicts honestly.

Subagents must not silently broaden scope. They return distilled findings or implementation summaries with relevant paths, symbols, commands, reproduction evidence, and confidence, not unfiltered command logs.

## Capacity and wave scheduling

- Treat the configured thread cap as an upper bound, not proof that every client currently exposes that many slots. Reserve the root thread for coordination when it counts toward the cap.
- Launch every ready independent lane up to actual safe capacity. Queue excess lanes by dependency, criticality, uncertainty, and value.
- When a slot opens, start the next ready lane immediately; do not wait for the rest of a wave.
- Reuse coordinator discovery and a shared repository census. Bound each lane to its own evidence or ownership area instead of making every worker rediscover the entire repository.
- Avoid redundant searches, duplicated expensive operations, idle workers, and artificial lanes created only to raise agent count.
- Add lanes dynamically when new independent work appears. Collapse or cancel redundant lanes, preserve useful partial results, and never ignore a slower worker's material output merely because faster lanes finished first.

## Incremental result use

Use worker output as it becomes available. The coordinator must:

- review critical results promptly;
- begin synthesis or implementation from sufficiently verified completed lanes;
- proceed without unrelated workers when their results do not block the next safe step;
- surface major findings early;
- preserve unresolved dependencies explicitly;
- integrate in safe increments; and
- keep unrelated lanes running during review and integration.

A completed worker result must not sit unused merely because other lanes are still active.

## Worker capability and reasoning routing

When the installed client supports per-agent selection, verify available models and reasoning settings rather than inventing aliases. Use the fastest capable available worker, generally with balanced reasoning, for mechanical repository census and inventories, repository searches, file/symbol/route/import inventories, dependency mapping, repetitive comparisons, classifications, documentation checks, straightforward result classification, and bounded homogeneous read-only scans. Reserve high reasoning effort for work that actually requires it. Use a stronger worker with high reasoning for complex code paths, performance, accessibility, security, architecture, data flow, difficult diagnosis and implementation, runtime diagnosis, subtle regressions, reconciliation, verification, and cross-system contracts. Use the strongest appropriate available capability for coordination, decomposition, high-risk decisions, shared architecture, integration, synthesis, and final verification.

Do not assign maximum reasoning effort to every worker by habit. Reassign work from an unnecessarily slow configuration when a faster capable worker can complete it reliably, but never downgrade a lane when doing so would materially reduce reliability. Model and reasoning selection must optimize both reliability and elapsed completion time.

## Read-heavy workflow policy

Audits, reviews, discovery, research, mapping, inventories, diagnostics, and verification strongly default to parallel read-only specialist lanes divided by subsystem, concern, library, package, route group, risk category, evidence source, or acceptance criterion. Use repository-wide search before deep file inspection, reuse a shared repository census, and give every lane a distinct evidence boundary. A verification lane or the coordinator must recheck severe or disputed findings. Reports distinguish confirmed findings, probable findings, and unverified suspicions and include paths, symbols, reproduction steps, evidence, and confidence where applicable.

Read-only lanes may inspect a shared file concurrently but may not mutate Git state, runtime state, databases, generated output, or external systems without explicit authorization.

Broad read-heavy tasks should normally use more workers than write-heavy tasks because read-only concurrency presents fewer collision risks.

## Write-heavy workflow policy

- Partition implementation by non-overlapping files, components, packages, or services. Exactly one agent may write a file at a time.
- Before launching a writer, complete the write-lane path verification required by the visible-disclosure policy. Any unresolved or unverified path keeps the lane read-only while safe discovery continues.
- Use separate Codex worktrees for independent implementation chats or lanes when supported and appropriate. Otherwise declare strict path ownership before editing.
- Designate one integration owner for shared files. Lockfiles, manifests, central configuration, schemas, migrations, generated artifacts, global styles, providers, route definitions, and entrypoints each have one authoritative lane.
- Sequence dependent changes through the plan's dependency graph. Use an explicit handoff before ownership moves between agents.
- Each implementation lane runs focused checks for its bounded work; centralized integration validation follows combination.
- Never casually merge over, overwrite, stage, or discard another lane's or the user's changes.

## Runtime and expensive-resource ownership

Assign one authoritative owner for each shared or expensive resource: the development server, port `3000`, shared browser sessions, databases, migration execution, dependency installation, manifests and lockfiles, production builds, full end-to-end suites, full validation, generated assets, deployment environments, final Git integration, `Codex_Chats` synchronization, and `Development_Docs` synchronization.

Other lanes may consume existing logs or results and request targeted checks from the owner. They must not start a competing server, mutate shared database state, regenerate shared artifacts, install dependencies, or run a duplicate full suite without a demonstrated need and safe isolation. Before acquiring a runtime, inspect recorded state and listeners; release or hand off ownership explicitly.

## Testing and validation parallelization

- Run safe independent unit-test groups concurrently and shard by package, subsystem, feature, or test type.
- Let implementation lanes run focused checks for their work. Do not make every lane run the complete suite.
- Test high-risk assumptions early so failures do not invalidate large amounts of downstream work.
- Assign one integrated type-check owner, one integrated lint owner when needed, one production-build owner, one final E2E owner, and one final full-validation owner. A single validation lane may own several of these serialized operations.
- Run the full required acceptance gate once when the integrated state is ready enough for the result to be useful, unless the task or failure investigation demonstrates a reason for an additional run.
- Do not duplicate builds, full suites, server starts, browser checks, or repository evidence without a demonstrated need; reuse valid evidence when its state and scope still match.
- Preserve failure evidence and classify failures immediately as pre-existing, task-induced, environmental, intermittent, or unresolved so unrelated work can continue.
- Treat shared-database mutation suites and runtime-dependent checks as exclusive resources unless isolation is proven.

Speed may never be obtained by silently skipping required validation.

## Context management

The main thread retains requirements, decisions, dependency state, ownership, integration status, unresolved questions, and final conclusions. Subagents absorb noisy searches, logs, stack traces, and repetitive evidence gathering, then return compact structured summaries. Store or reference large raw output instead of repeatedly pasting it. Summarization must not drop user requirements, unknowns, decisions, blockers, or unreviewed results.

## Failure and recovery

If one lane fails, independent lanes continue. The failed lane returns partial evidence and its blocker and safely releases any file, runtime, or resource lock. Preserve completed work and useful output. Retry only when conditions change; otherwise narrow, split, reassign, or serialize only the affected portion. Do not restart all work because one lane failed. Record downstream impact, disclose unresolved gaps, and request user intervention only when authority, information, or an external state change is genuinely required.

## Completion standard

Do not claim a nontrivial task complete until:

- every required workstream is complete or explicitly accounted for;
- all agent output that could materially change the result has been reviewed;
- duplicates, contradictions, and conflicting conclusions are reconciled or disclosed;
- shared-file integration and ownership handoffs are complete;
- focused and required cross-cutting validation has run on the integrated state;
- the result has been rechecked against the original request;
- skipped checks, known limitations, unresolved risks, and pre-existing failures are reported accurately;
- final repository synchronization has run exactly once under the authorized coordinator; and
- no worker remains active whose output could materially change the conclusion.

## Execution plans

Every task uses the Tier 0 parallelization minimum in root `PLANS.md`. Standard multi-step work uses Tier 1, and every substantial cross-system, audit, refactor, migration, documentation, architecture, long-running, or high-risk implementation uses Tier 2. The plan may remain in task coordination state or be written to the requested artifact. When a durable authored plan is required, place it under `Development_Docs`; root `PLANS.md` is the reusable standard, not a competing plan archive. Update plans when discoveries change dependencies, ownership, safe concurrency, validation, or risk, while preserving completed work.

## Shared development documentation

`Development_Docs` at the repository root is the canonical shared location for development requirements, project history, architecture, decisions, implementation plans, and related authored documentation.

Before beginning work that depends on those materials:

1. Confirm the repository, active branch, upstream, and complete working-tree state.
2. Preserve any local modifications, then run `git fetch --prune origin`.
3. Determine whether the branch is behind, ahead, or diverged with `git rev-list --left-right --count "HEAD...@{upstream}"`.
4. Pull with `--ff-only`, or rebase when the repository's branch policy permits it, only when the operation is demonstrably safe. Never discard local work to synchronize.
5. If the same document changed on two computers, preserve both sets of work and surface conflicts. Perform a normal textual merge only when clearly correct. Keep clearly differentiated variants of unmergeable binary documents when appropriate, and never push unresolved conflict markers.

Never use `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git restore .`, `git push --force`, or `git push --force-with-lease` as synchronization shortcuts.

Inspect `Development_Docs` before work when project history, requirements, architecture, decisions, or plans are relevant. Update a relevant document when an implementation decision makes it inaccurate, but do not modify unrelated documents merely because they were read. Preserve authored content and native formatting, avoid normalization churn, and do not use the directory for routine terminal output or generated test/build artifacts. Never upload secrets, credentials, private configuration, production data, or unapproved sensitive company information.

## Mandatory task finalization

For every Codex task performed in this repository, conversation and development-document synchronization is a required finalization gate. Do not delete or weaken these steps:

1. Complete and test the requested project work.
2. Inspect the complete working tree and classify task changes, `Development_Docs` changes, `Codex_Chats` changes, unrelated pre-existing work, and generated files. Never stage the whole repository by default.
3. Run `python scripts/sync_codex_chats.py --dry-run`. Review conversation classifications and the structured `development_docs` status, including eligible, excluded, suspicious, large, conflicted, renamed, and deleted paths.
4. Run `python scripts/sync_codex_chats.py` to ingest every currently accessible project-associated Codex session and any newer export in `Codex_Chats/imports/`, and to commit eligible `Development_Docs` changes through the same path-scoped workflow.
5. Run `python scripts/sync_codex_chats.py --validate`, inspect the exact synchronization-owned Git diff, and re-check the complete repository status.
6. Confirm each command's exit status and structured report. Never claim a conversation was archived unless a source was read and a transcript was written successfully. Never claim documentation was synchronized unless the reported commit and push state prove it.
7. If synchronization content changed, confirm the scoped commit and permitted push succeeded and verify the remote SHA. If nothing changed, confirm no empty commit was created. Report unrelated remaining changes accurately.
8. Include concise `Chat archive:` and `Development docs:` result lines in the final response.

The synchronizer is deliberately not a `post-commit` hook because many prompts finish without a code commit. The Codex host currently exposes no repository task-completion hook that can be versioned here, so this instruction is authoritative. A task's final assistant message can only be captured on the next synchronization because it does not exist until after the pre-finalization run; the next task must update that same stable conversation rather than creating a duplicate.

`Development_Docs` remains a normal Git-tracked directory. Do not copy it into `Codex_Chats`, archive it as transcripts, or maintain a duplicate mirror. The synchronizer may commit only explicit eligible paths; it must leave ignored, suspicious, oversized, conflicted, and unrelated files untouched. Do not commit raw ChatGPT exports or bypass a secret warning, unsafe Git state, ambiguous classification, source failure, integrity failure, branch divergence, or protected-branch policy.
