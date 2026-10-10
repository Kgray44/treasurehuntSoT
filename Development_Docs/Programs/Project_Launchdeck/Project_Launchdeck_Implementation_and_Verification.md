---
title: Project Launchdeck implementation and verification
audience: engineering
status: current
canonical_for: project-launchdeck-implementation-verification
last_reviewed: 2026-10-10
---

# Project Launchdeck

Project Launchdeck is an owner-requested private workflow plugin for creating agreed implementation Work chats from a regular ChatGPT Chat inside the same desktop app. Its source of truth is `.agents/plugins/project-launchdeck`, with the project-local entrypoint `.agents/skills/project-launchdeck/SKILL.md`. The package uses the existing optional GitHub connector for repository context and actual native host tools for launch. Both manifests require a local executor. The first same-app acceptance failed because native launch tools were absent in the source Chat; that requirement flag has not proved sufficient. No browser or external bridge is part of this workflow.

## Scope and source ownership

The owner's requested routing default is the VoyageWright Codex project, never the current ChatGPT project unless explicitly overridden. Any accessible task-relevant project/repository content may inform the launch; no file allowlist restricts the workflow. Project Trim controls initial disclosure, not permissible context expansion. Source access does not grant new mutation authorization or bypass current repository authority.

Titles use `{Project} Phase {N}: {Phase Name}` or `{A} + {B}: {Purpose}`, omit VoyageWright, and allocate the lowest available V2/V3 suffix. Frozen exact-text request fingerprints plus one owner-local locked journal prevent blind duplicate retries through this helper. Case-sensitive source/requirement identifiers remain distinct. Unknown outcomes require reconciliation; pending client IDs are not ready thread IDs. Native identifiers cannot be erased or replaced through receipt updates. A Goal is requested in the implementation prompt and is reported verified only when actual target evidence confirms it. Cleanup archives only tracked disposable relays created by that launch after durable target verification.

The native creation schema has no Goal field or idempotency parameter. Current native list_threads returns at most 50 non-pinned recent chats, so global title uniqueness and exactly-once guarantees across independent launchers are not claimed. Missing host dispatch produces a ready-to-launch prompt. The journal stores safe request/route/title/state/ID metadata and does not retain full prompts or transcripts.

## Project Trim binding

Project Trim records were inspected at fetched main `a9e8a79435cdf4eab14681f1ddf2320ae2a59443`. The accepted historical closure is `5a58cfb34696aa3f256c5a8157791dfb226ee4f0`. Current main retains its accepted records and seven-profile definition but lacks the referenced scripts/agent-context helpers. Launchdeck therefore provides a labeled short-contract adaptation, not a canonical packet-v2 generator. It preserves required governing reads, source bindings and stale-context expansion, current completion authority, unique scope/non-goals/deliverables, advisory budgets, and null/UNAVAILABLE accounting. It makes no measured end-to-end token-savings claim.

## Verification

- IMPLEMENTED: repository-owned package, project-local router, Project Trim adaptation, deterministic planner, durable journal, reproducible packager, optional GitHub app binding, and nautical SVG assets.
- FOCUSED VALIDATED: 33 Python standard-library checks cover correct/wrong/ambiguous routing, governing phase names and multi-initiative titles, collision allocation, exact-text retry keys, uncertain outcomes, pending IDs, proven no-side-effect retry, corruption/lock conflicts, worktree/budget/new-run authorization, typed immutable identity evidence, retained gates/contracts, accounting labels, concurrent distinct reservations, and concurrent same-request retries.
- FOCUSED VALIDATED: bundled skill validator accepted launch-task and project-trim; package validator checked identity, subtitle length, contained assets, SVG dimensions, source links, verified app binding, synchronized compatibility manifest, and ZIP integrity.
- INTEGRATION VALIDATED: native list_projects/read_thread/list_threads reads worked in Work; the GitHub connector fetched the Project Trim completion receipt at the inspected commit; Plugin Creator saved and listed 13 package files as a private personal plugin. The repository-local marketplace installation reports enabled/installed v0.2.1.
- ACCEPTANCE FAILED: Test A/B was submitted to the existing in-app ChatGPT discussion, requesting Crossdeck Phase 2: Keep One Deck and a unique context-fidelity marker before edits. Supported read_thread confirmed delivery and completion but returned an opaque content reference for its answer. The owner supplied the answer: UNSUPPORTED ON THIS SURFACE; native project discovery, creation, Goal, status and verification tools were missing. The source inspected private v0.2.0 identity/files but created no task, Goal, worktree or relay, delivered no marker, and started no implementation. This is source-Chat evidence supplied by the owner, not direct target proof.
- NOT VALIDATED: actual native creation/Goal, live continuation or new-run versioning, native title race repair, relay archiving, and three parallel native implementation tasks. Helper concurrency tests are not native parallel execution proof.
- LIVE REJECTION OBSERVED: automatic approval review rejected the command intended to reserve Parallax/Sextant acceptance launches with only 'blocked by policy'. That command did not execute; those launches remain undispatched. It supplies rejection evidence, not simulated native provider permission/timeout proof.
- NOT VALIDATED: protected mainline/release qualification. This source proposal is separate from private plugin account publication.

Private plugin ID: `plugins_6acaae49c3b48191952700f8888120d0`. Saved v0.2.1 release: `pluginrel_6acab1fa9fdc8191b91a0bcbcbcc031b`. Private account listing: `https://chatgpt.com/plugins/plugins_6acaae49c3b48191952700f8888120d0`. Distribution archive SHA-256: `049ddba7dcfe4cac4a1fa2c4e8da873b9186b982d77839adcab4635d7ad6fc65`. Repository source and local installation are separate from account publication; source proposal is not protected-main qualification.

## Required acceptance labels

| Label                                  | Observed result                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| PLUGIN CREATED                         | Verified private account publication, v0.2.1.                                                                            |
| PLUGIN INSTALLED AND INVOCABLE         | Local Codex install/enabled verified; private identity inspected in source Chat; source-Chat native invocation unproved. |
| GITHUB CONTEXT VERIFIED                | Authenticated connector read at inspected protected main; current governance and Trim records inspected.                 |
| CONVERSATION CONTEXT VERIFIED          | Source launch requirement delivery verified; transfer to a native target failed because none was created.                |
| NATIVE CODEX PROJECT ROUTING VERIFIED  | Exact live VoyageWright project discovered from Work; unavailable in source Chat.                                        |
| NATIVE CONVERSATION CREATION VERIFIED  | No; A/B source Chat lacked creation tools and created nothing.                                                           |
| NAMING AND DUPLICATE HANDLING VERIFIED | Helper tests pass; live native creation/continuation/collision repair untested.                                          |
| PARALLEL EXECUTION VERIFIED            | No; concurrent reservation tests only.                                                                                   |
| END-TO-END ACCEPTANCE PASSED           | No; required same-app Chat-to-Work handoff failed.                                                                       |

The public dependency resolver did not resolve this private plugin; it requires a public global listing. That failure is not evidence that the declared GitHub app binding failed. Binding files and the direct authenticated read provide the current integration evidence; installed-plugin dispatch still needs a real authorized launch.

## Documentation and feature classification

Skills, references, manifests, assets, and automation entrypoints are active automation under `.agents`; helpers and tests are automation tooling. This record is engineering evidence under Development_Docs. The automation README links the new entrypoint, and the engineering index is generated. No VoyageWright product capability or availability changed, so no owning feature fragment update is required. Focused automation tests and repository documentation/feature checks apply; product/browser/device/database/build tests are outside this change because no product source, schema, runtime, route, or hardware behavior changed.
