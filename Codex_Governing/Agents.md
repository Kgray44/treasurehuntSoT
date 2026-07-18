# Repository instructions

## Purpose and instruction hierarchy

This file governs repository-wide Codex behavior. `PLANS.md` defines the required execution-planning method for nontrivial work; read it before planning or delegating a substantial task. This framework applies automatically to current and future tasks, but it never overrides current or future user instructions.

Apply instructions in this order:

1. The user's current task instructions define what must be done and the required result.
2. Governing project documents, especially approved material in `Development_Docs`, define product behavior, architecture, and domain requirements.
3. `AGENTS.md` and `PLANS.md` define how Codex organizes and executes that work.
4. More specialized directory instructions may add local constraints. They must not silently weaken this repository baseline without a concrete safety, dependency, or conflict reason.

Parallelization is an execution method, not permission to reinterpret the task. Preserve every task-specific scope boundary, constraint, term, acceptance criterion, methodology, and output format. If parallel execution conflicts with correctness or a task requirement, correctness and the task requirement win.

Do not restart, discard, replace, or re-scope existing work merely because this framework is introduced or discovered. For work already in progress, preserve completed work and all prior directions, then parallelize only remaining independent work. In particular, the animation audit active when this framework was adopted remains governed by its original audit prompt, plan, categories, depth, evidence rules, report structure, scope, and conclusions; this policy may improve execution of remaining independent lanes but may not replace or revise that audit.

## Canonical repository context

- The canonical Git repository is `Kgray44/treasurehuntSoT`; the repository root is the directory returned by `git rev-parse --show-toplevel` (this checkout: `C:\Users\kkids\Documents\Codex_TreasureHunt`). `main` is the canonical integrated branch.
- The canonical active application is the single Next.js App Router package at the repository root, named `forever-treasure-companion` and presented as the unified Tall Tale platform / Forever Treasure Companion. Do not treat snapshots, compatibility routes, validation copies, or former feature branches as alternate applications.
- Primary implementation locations are `src/app`, `src/components`, `src/animation`, `src/domain`, `src/lib`, `src/platform`, `src/server`, `src/tall-tale`, `prisma`, `public`, and `scripts`. Tests live beside source as `*.test.*` and under `tests/e2e`.
- `Development_Docs` is the canonical shared location for requirements, history, architecture, decisions, and authored plans. `docs` contains maintained product and engineering documentation. `Codex_Chats` is a conversation archive, not application source.
- No separate obsolete application tree is currently verified. Former feature branches are integrated history. The development-only `/dev/animations` route is not an obsolete application.
- Generated, local, archived, or excluded locations include `node_modules`, `.next`, `out`, `build`, `coverage`, `.runtime`, `.data`, `backups`, local database files, `test-results`, `playwright-report`, `playwright/.auth`, `artifacts/screenshots`, `artifacts/validation`, local logs, and Codex import/cache/temp content identified by `.gitignore`. Do not modify or cite these as canonical source. In particular, `artifacts/validation/animation-audit/baseline/AGENTS.md` is an ignored generated snapshot, not an active nested instruction file.

Verify the canonical implementation before broad exploration or modification. Do not create port-specific application copies, abandoned local variants, duplicate runtimes, or parallel implementations of existing canonical surfaces.

### Verified commands and ports

| Purpose | Verified command or behavior |
| --- | --- |
| Canonical development start | `npm run dev:full` |
| Canonical development stop | `npm run dev:stop` |
| Canonical development address | `http://127.0.0.1:3000`; port `3000` has one owner |
| Next-only development after setup | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Format check | `npm run format:check` |
| Strict type check | `npm run typecheck` |
| Unit/component tests | `npm test` |
| End-to-end tests | `npm run test:e2e` |
| Animation asset contracts | `npm run assets:validate` |
| Full repository validation | `npm run validate` |

There is no separate verified `test:integration` script; integration behavior is covered by the focused Vitest/Playwright checks and the full `npm run validate` gate. Playwright normally owns an isolated server on port `3100`, and full validation normally uses port `3200` for production restart proof. Those are controlled validation resources, not authorization to start competing development servers. An explicitly isolated alternate development port is an exception for a demonstrated need, not a new application copy.

## Parallelization-first default

Every current or future nontrivial task begins automatically with a parallelization assessment using `PLANS.md`. Before work starts, identify independent workstreams, dependency edges, shared resources, likely file conflicts, immediately ready lanes, serialized gates, the coordinator, and bounded specialist ownership. Start all ready independent lanes concurrently, and keep dependent lanes blocked until prerequisites are satisfied. Record the decomposition and concrete reasons for serialization in the execution plan for substantial tasks.

This repository policy is standing authorization to use subagents whenever they improve speed, coverage, reliability, or context management. The user does not need to say "use subagents," "run this in parallel," or "spawn agents." Use the greatest safe and useful concurrency available while respecting host limits, ownership, and task requirements.

## Mandatory parallelization triggers

Use parallel subagents when a task contains two or more meaningfully independent areas, including:

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
- track dependencies and shared resources while keeping raw logs and noisy exploration out of the main context;
- collect concise evidence-backed summaries, reconcile disagreements, and directly verify severe, risky, or uncertain findings;
- integrate in dependency order, review the combined diff, run cross-cutting validation, and check the result against the original request;
- produce one coherent final result rather than concatenating worker reports; and
- own the single mandatory `Codex_Chats` / `Development_Docs` finalization workflow unless it explicitly delegates that exclusive responsibility.

Do not redo delegated work except for necessary verification. Workers must not fetch, pull, rebase, merge, commit, push, or run the synchronization workflow unless the coordinator explicitly grants that bounded authority.

## Subagent contract

Every delegated lane must state:

- precise objective and background;
- explicit scope and non-scope;
- read-only or write authorization;
- owned files, directories, components, or concerns;
- dependencies and shared resources it may not modify;
- required searches, evidence, and validation;
- required deliverable and compact return format;
- completion and stop conditions; and
- instructions to report blockers, partial results, uncertainty, and ownership conflicts honestly.

Subagents must not silently broaden scope. They return distilled findings or implementation summaries with relevant paths, symbols, commands, reproduction evidence, and confidence, not unfiltered command logs.

## Concurrency policy

- Launch all ready independent lanes together; do not wait for one independent lane before starting another.
- Prefer several meaningful workstreams to dozens of microscopic agents. Adjust concurrency to the dependency graph, resource capacity, and conflict risk; no fixed agent count applies.
- Reuse coordinator discovery. Bound each lane to its own evidence or ownership area instead of making every worker scan the whole repository.
- Avoid redundant searches, duplicated expensive operations, and artificial lanes created only to raise agent count.
- Add lanes dynamically when new independent work appears. Collapse or cancel lanes that become redundant, and preserve useful partial results.

## Read-heavy workflow policy

Audits, reviews, discovery, research, mapping, and diagnostics default to parallel read-only specialist lanes divided by subsystem, concern, library, package, route group, risk category, or evidence source. Use repository-wide search before deep file inspection and give every lane a distinct evidence boundary. A verification lane or the coordinator must recheck severe or disputed findings. Reports distinguish confirmed findings from suspicions and include paths, symbols, reproduction steps, evidence, and confidence where applicable.

Read-only lanes may inspect a shared file concurrently but may not mutate Git state, runtime state, databases, generated output, or external systems without explicit authorization.

## Write-heavy workflow policy

- Partition implementation by non-overlapping files, components, packages, or services. Exactly one agent may write a file at a time.
- Use separate Codex worktrees for independent implementation chats or lanes when supported and appropriate. Otherwise declare strict path ownership before editing.
- Designate one integration owner for shared files. Lockfiles, manifests, central configuration, schemas, migrations, generated artifacts, global styles, providers, route definitions, and entrypoints each have one authoritative lane.
- Sequence dependent changes through the plan's dependency graph. Use an explicit handoff before ownership moves between agents.
- Each implementation lane runs focused checks for its bounded work; centralized integration validation follows combination.
- Never casually merge over, overwrite, stage, or discard another lane's or the user's changes.

## Runtime and expensive-resource ownership

Assign one authoritative owner for each shared or expensive resource: the development server, port `3000`, shared browser sessions, databases, migration execution, full end-to-end suites, full production builds, dependency installation, manifests and lockfiles, generated assets, deployment environments, and the final synchronization workflow.

Other lanes may consume existing logs or results and request targeted checks from the owner. They must not start a competing server, mutate shared database state, regenerate shared artifacts, install dependencies, or run a duplicate full suite without a demonstrated need and safe isolation. Before acquiring a runtime, inspect recorded state and listeners; release or hand off ownership explicitly.

## Testing and validation parallelization

- Run safe independent unit-test groups concurrently and shard by package, subsystem, feature, or test type.
- Let implementation lanes run focused checks for their work. Do not make every lane run the complete suite.
- Assign one integration owner to deduplicate lint, type-check, build, browser, server, and database work and run broader cross-cutting checks after integration.
- Run the full required acceptance gate once on the ready integrated state unless the task or failure investigation requires an additional run.
- Preserve failure evidence and distinguish pre-existing failures from regressions introduced by the task.
- Treat shared-database mutation suites and runtime-dependent checks as exclusive resources unless isolation is proven.

## Context management

The main thread retains requirements, decisions, dependency state, ownership, integration status, unresolved questions, and final conclusions. Subagents absorb noisy searches, logs, stack traces, and repetitive evidence gathering, then return compact structured summaries. Store or reference large raw output instead of repeatedly pasting it. Summarization must not drop user requirements, unknowns, decisions, blockers, or unreviewed results.

## Failure and recovery

If one lane fails, independent lanes continue. The failed lane returns partial evidence and its blocker; the coordinator preserves completed work and may retry, narrow, split, reassign, or serialize only the affected portion. Do not restart all work because one lane failed. Record downstream impact, disclose unresolved gaps, and request user intervention only when authority, information, or an external state change is genuinely required.

## Completion standard

Do not claim a nontrivial task complete until:

- every required workstream is complete or explicitly accounted for;
- all agent output that could materially change the result has been reviewed;
- duplicates, contradictions, and conflicting conclusions are reconciled or disclosed;
- shared-file integration and ownership handoffs are complete;
- focused and required cross-cutting validation has run on the integrated state;
- the result has been rechecked against the original request; and
- skipped checks, known limitations, unresolved risks, and pre-existing failures are reported accurately.

## Execution plans

Every substantial multi-step, cross-system, audit, refactor, migration, documentation, architecture, or implementation task must follow the structure in `PLANS.md`. The plan may remain in the task's coordination state or be written to the task's requested planning artifact. When a durable authored plan is required, place it under `Development_Docs` according to that directory's rules; root `PLANS.md` is the reusable planning standard, not a competing plan archive. Update the plan when discoveries change dependencies, ownership, safe concurrency, validation, or risk, while preserving completed work.

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
