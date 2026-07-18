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

## Mandatory parallelization assessment

Every task performs at least a brief parallelization assessment before substantial work begins. A concise internal determination is sufficient only for a genuinely trivial task with no useful independent lane.

The assessment identifies:

- genuinely independent workstreams and immediately ready read-only discovery;
- whether an independent verification lane improves quality;
- possible divisions by subsystem, concern, package, route, component family, evidence source, acceptance criterion, test surface, or implementation boundary;
- dependency edges, shared files, exclusive resources, and serialized work;
- the maximum safe and useful concurrency, worktree needs, integration owner, and final-validation owner.

If two or more genuine independent lanes exist, parallel delegation is mandatory unless a concrete technical, safety, dependency, resource, capacity, or ownership reason prevents it. The repository policy itself is standing authorization; the user does not need to request subagents, delegation, workers, parallel execution, or the full available limit.

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

Verify the minimum safety baseline first: repository root, applicable instructions, user scope, working-tree state, existing task state, current modifications, exclusive resources, and destructive boundaries. Then launch obvious independent read-only lanes immediately while the coordinator refines the plan. Do not delay safe discovery until every planning table is complete. Do not start write lanes until ownership and integration boundaries are explicit. Add newly discovered ready lanes dynamically, collapse redundant lanes, release unused capacity, and preserve useful partial findings.

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
- owned files, directories, components, or concerns, plus forbidden paths and resources;
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

## Worker capability and reasoning routing

When the installed client supports per-agent selection, verify available models and reasoning settings rather than inventing aliases. Use the fastest capable available worker, generally with balanced reasoning, for mechanical repository census, file/symbol/route/import inventories, dependency mapping, repetitive documentation checks, straightforward result classification, and homogeneous read-only audits. Use a stronger worker with high reasoning for complex code paths, performance, accessibility, security, architecture, data flow, difficult implementation, subtle regressions, runtime diagnosis, and cross-system contracts. Use the strongest appropriate available capability for coordination, decomposition, reconciliation, high-risk decisions, shared architecture, integration, synthesis, and final verification. Never downgrade a lane when doing so would materially reduce reliability, and do not run every mechanical lane at the coordinator's maximum reasoning effort.

## Read-heavy workflow policy

Audits, reviews, discovery, research, mapping, inventories, diagnostics, and verification strongly default to parallel read-only specialist lanes divided by subsystem, concern, library, package, route group, risk category, evidence source, or acceptance criterion. Use repository-wide search before deep file inspection, reuse a shared repository census, and give every lane a distinct evidence boundary. A verification lane or the coordinator must recheck severe or disputed findings. Reports distinguish confirmed findings, probable findings, and unverified suspicions and include paths, symbols, reproduction steps, evidence, and confidence where applicable.

Read-only lanes may inspect a shared file concurrently but may not mutate Git state, runtime state, databases, generated output, or external systems without explicit authorization.

Broad read-heavy tasks should normally use more workers than write-heavy tasks because read-only concurrency presents fewer collision risks.

## Write-heavy workflow policy

- Partition implementation by non-overlapping files, components, packages, or services. Exactly one agent may write a file at a time.
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
- Assign one integrated type-check owner, one integrated lint owner when needed, one production-build owner, one final E2E owner, and one final full-validation owner. A single validation lane may own several of these serialized operations.
- Run the full required acceptance gate once on the ready integrated state unless the task or failure investigation requires an additional run.
- Preserve failure evidence and classify failures as pre-existing, task-induced, environmental, intermittent, or unresolved.
- Treat shared-database mutation suites and runtime-dependent checks as exclusive resources unless isolation is proven.

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
