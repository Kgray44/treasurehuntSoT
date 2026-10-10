---
title: Project Launchdeck implementation and verification
audience: engineering
status: current
canonical_for: project-launchdeck-implementation-verification
last_reviewed: 2026-10-10
---

# Project Launchdeck

Project Launchdeck is an owner-requested private workflow plugin for creating agreed implementation Work chats from a regular ChatGPT Chat inside the same desktop app. Its source of truth is `.agents/plugins/project-launchdeck`, with the project-local entrypoint `.agents/skills/project-launchdeck/SKILL.md`. v0.3.1 uses each invoking surface's actual context, GitHub and native tools, with requires_local_executor:false in both manifests. It gathers necessary context and directly creates a separate native Work chat while preserving the source Chat. Continuing the source in Work, migration and preparation/executor relays are excluded by the owner's clarified requirement. Source Chat reported native creation and executable skill exposure unavailable; installation cannot grant those missing operations. No browser or external bridge is part of this workflow.

## Executable launch action remains undelivered

The owner clarified that the plugin itself must provide an executable action which receives necessary discussion context and internally creates the separate Work chat. The existing package is skills plus deterministic planning/receipt helpers; it has no MCP server or plugin-owned native creation action. Having a chat call the desktop provider directly does not prove that requirement. The package and listing now state this limitation explicitly.

The installed native provider requires a host connection and host-supplied conversation identity, and exposes different tool catalogs for Chat/Work. These internal details do not establish a supported public binding for a custom plugin action. No source-Chat executable Launchdeck action or usable native service binding has been observed. A disconnected adapter/mock, copied proprietary provider, manually supplied caller identity or remote pipe bridge would not establish a supported implementation. No such substitute was created. The plugin is a partial implementation, and the automatic launch goal remains unfulfilled.

## Scope and source ownership

The owner's requested routing default is the VoyageWright Codex project, never the current ChatGPT project unless explicitly overridden. Any accessible task-relevant project/repository content may inform the launch; no file allowlist restricts the workflow. Project Trim controls initial disclosure, not permissible context expansion. Source access does not grant new mutation authorization or bypass current repository authority.

Titles use `{Project} Phase {N}: {Phase Name}` or `{A} + {B}: {Purpose}`, omit VoyageWright, and allocate the lowest available V2/V3 suffix. Frozen exact-text request fingerprints plus one owner-local locked journal prevent blind duplicate retries through this helper. Case-sensitive source/requirement identifiers remain distinct. Unknown outcomes require reconciliation; pending client IDs are not ready thread IDs. Native identifiers cannot be erased or replaced through receipt updates. A Goal is requested in the implementation prompt and is reported verified only when actual target evidence confirms it. New launches create no relays. Cleanup applies only to explicitly tracked historical disposable relays after durable target verification and settled relay work.

The native creation schema has no Goal field or idempotency parameter. Current native list_threads returns at most 50 non-pinned recent chats, so global title uniqueness and exactly-once guarantees across independent launchers are not claimed. Missing host dispatch produces a ready-to-launch prompt. The journal stores safe request/route/title/state/ID metadata and does not retain full prompts or transcripts.

## Project Trim binding

Project Trim records were inspected at fetched main `a9e8a79435cdf4eab14681f1ddf2320ae2a59443`. The accepted historical closure is `5a58cfb34696aa3f256c5a8157791dfb226ee4f0`. Current main retains its accepted records and seven-profile definition but lacks the referenced scripts/agent-context helpers. Launchdeck therefore provides a labeled short-contract adaptation, not a canonical packet-v2 generator. It preserves required governing reads, source bindings and stale-context expansion, current completion authority, unique scope/non-goals/deliverables, advisory budgets, and null/UNAVAILABLE accounting. It makes no measured end-to-end token-savings claim.

## Verification

- IMPLEMENTED: repository-owned package, project-local router, Project Trim adaptation, deterministic planner, durable journal, reproducible packager, optional GitHub app binding, and nautical SVG assets.
- FOCUSED VALIDATED: 33 Python standard-library checks cover correct/wrong/ambiguous routing, governing phase names and multi-initiative titles, collision allocation, exact-text retry keys, uncertain outcomes, pending IDs, proven no-side-effect retry, corruption/lock conflicts, worktree/budget/new-run authorization, typed immutable identity evidence, retained gates/contracts, accounting labels, concurrent distinct reservations, and concurrent same-request retries.
- FOCUSED VALIDATED: bundled skill validator accepted launch-task and project-trim; package validator checked identity, subtitle length, contained assets, SVG dimensions, source links, verified app binding, synchronized compatibility manifest, and ZIP integrity.
- INTEGRATION VALIDATED: native list_projects/read_thread/list_threads reads worked in Work; the GitHub connector fetched the Project Trim completion receipt at the inspected commit; Plugin Creator saved and listed 14 package files as a private personal plugin v0.3.0; readback verified both executor flags false, direct-creation instructions, and retained app/assets/default prompts. The repository-local marketplace installation reports installed v0.3.0. Bundled native provider v0.1.6 and GitHub are enabled; a supported provider reinstall hit Windows cache Access is denied, leaving the existing provider working.
- ACCEPTANCE FAILED: Test A/B was submitted to the existing in-app ChatGPT discussion, requesting Crossdeck Phase 2: Keep One Deck and a unique context-fidelity marker before edits. Supported read_thread confirmed delivery and completion but returned an opaque content reference for its answer. The owner supplied the answer: UNSUPPORTED ON THIS SURFACE; native project discovery, creation, Goal, status and verification tools were missing. The source inspected private v0.2.0 identity/files but created no task, Goal, worktree or relay, delivered no marker, and started no implementation. This is source-Chat evidence supplied by the owner, not direct target proof.
- HISTORICAL HANDOFF ATTEMPTS: the owner supplied a setup-retry answer reporting 'The user chose not to hand off.' One later human-authorized retry completed; its assistant answer remained opaque to read_thread. The owner then rejected source continuation/executor relays as the intended workflow. v0.3.0 removes that fallback.
- DIRECT CREATION UNAVAILABLE: after the owner's correction, the existing source Chat completed an actual tool/skill availability check. The owner supplied its answer: DIRECT NATIVE LAUNCH UNAVAILABLE; native Codex project discovery/inventory/creation/Goal/worktree status and Launchdeck's executable skill were not exposed, and no equivalent background creation tool was found. It reported both previous handoff attempts unsuccessful with no task created, acknowledged it could not independently inspect live native inventory, and made no launch or handoff this turn. Work-side recent inventory exposed no Crossdeck target; the bounded inventory is not global no-side-effect proof. No native target identity, Goal or link has been observed. This is an unresolved platform exposure gap, not successful automatic creation.
- NOT VALIDATED: actual native creation/Goal, live continuation or new-run versioning, native title race repair, relay archiving, and three parallel native implementation tasks. Helper concurrency tests are not native parallel execution proof.
- LIVE REJECTION OBSERVED: automatic approval review rejected the command intended to reserve Parallax/Sextant acceptance launches with only 'blocked by policy'. That command did not execute; those launches remain undispatched. It supplies rejection evidence, not simulated native provider permission/timeout proof.
- NOT VALIDATED: protected mainline/release qualification. This source proposal is separate from private plugin account publication.

Private plugin ID: `plugins_6acaae49c3b48191952700f8888120d0`. Saved v0.3.0 release: `pluginrel_6acab71f9e748191ac966cb961f5e3f0`. Private account listing: `https://chatgpt.com/plugins/plugins_6acaae49c3b48191952700f8888120d0`. Distribution archive SHA-256: `a9a78ec9b5fa682320680b8c4f9fa710728aa6b8c28c1244f65df6fbea855265`. Repository source and local installation are separate from account publication. Draft PR #696's initial source candidate `2e0d079a51a2813a4fda9187c0015bf81ad4df60` passed ordinary Sounding Line run `38088974932`; changed candidates need fresh evidence. Source qualification does not establish direct Chat-origin target acceptance or landed qualification.

## Required acceptance labels

| Label                                  | Observed result                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| PLUGIN CREATED                         | Verified private account publication, v0.3.0.                                                                            |
| PLUGIN INSTALLED AND INVOCABLE         | Local Codex install/enabled verified; private identity inspected in source Chat; source-Chat native invocation unproved. |
| GITHUB CONTEXT VERIFIED                | Authenticated connector read at inspected protected main; current governance and Trim records inspected.                 |
| CONVERSATION CONTEXT VERIFIED          | Source launch requirement delivery verified; transfer to a native target failed because none was created.                |
| NATIVE CODEX PROJECT ROUTING VERIFIED  | Exact live VoyageWright project discovered from Work; unavailable in source Chat.                                        |
| NATIVE CONVERSATION CREATION VERIFIED  | No; A/B source Chat lacked creation tools and created nothing.                                                           |
| NAMING AND DUPLICATE HANDLING VERIFIED | Helper tests pass; live native creation/continuation/collision repair untested.                                          |
| PARALLEL EXECUTION VERIFIED            | No; concurrent reservation tests only.                                                                                   |
| END-TO-END ACCEPTANCE PASSED           | No; direct separate native creation and executable skill unavailable in source Chat.                                     |

The public dependency resolver did not resolve this private plugin; it requires a public global listing. That failure is not evidence that the declared GitHub app binding failed. Binding files and the direct authenticated read provide the current integration evidence; installed-plugin dispatch still needs a real authorized launch.

## Documentation and feature classification

Skills, references, manifests, assets, and automation entrypoints are active automation under `.agents`; helpers and tests are automation tooling. This record is engineering evidence under Development_Docs. The automation README links the new entrypoint, and the engineering index is generated. No VoyageWright product capability or availability changed, so no owning feature fragment update is required. Focused automation tests and repository documentation/feature checks apply; product/browser/device/database/build tests are outside this change because no product source, schema, runtime, route, or hardware behavior changed.
