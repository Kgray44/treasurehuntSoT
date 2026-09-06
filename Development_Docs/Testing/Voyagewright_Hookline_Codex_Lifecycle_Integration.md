---
title: Voyagewright Hookline Codex Lifecycle Integration
audience: developers
status: development-only
canonical_for: voyagewright-hookline-codex-lifecycle-integration
last_reviewed: 2026-09-04
---

# Voyagewright Hookline Codex Lifecycle Integration

## Purpose and activation

Hookline is a small repository-local Codex Hooks increment. It adds bounded session continuity, command guardrails, private local telemetry, and subagent lifecycle context without replacing protected-main controls, GitHub authorization, Sounding Line, database authorization, or sandboxing.

The tracked definition is `.codex/hooks.json`; it is the only Hooks representation in this project layer. The existing `.codex/config.toml` continues to own agent settings. Codex discovers project hooks only after normal project trust review. Review the exact definition with `/hooks`; changed definitions are skipped until trusted. Do not use `--dangerously-bypass-hook-trust` for normal engineering or acceptance.

The checked-in default is `GUARD`. `OBSERVE` keeps lifecycle/context/telemetry active and only blocks absolutely destructive commands; `GUARD` also blocks the defined broad-repository restorations; `CONTINUITY` additionally permits one state-proven Stop continuation. `HOOKLINE_MODE` may select a mode for a deliberately scoped session. `HOOKLINE_MAX_CONTINUATIONS` can lower or raise the bounded budget from the checked-in default of one, with a hard maximum of ten. Permission auto-approval remains disabled regardless of mode; `futurePermissionAllowlist` is configuration-only preparation, not authority.

## Event coverage

| Event                        | Behavior                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`               | Creates or restores a compact local capsule; on `compact`, returns the same small objective/work/branch/test context before the next model request. |
| `PreCompact` / `PostCompact` | Record the compaction boundary without reading transcript internals.                                                                                |
| `SessionEnd`                 | Marks the capsule ended and appends a final lifecycle record.                                                                                       |
| `PreToolUse`                 | Synchronously blocks defined destructive Bash commands before execution.                                                                            |
| `PermissionRequest`          | Denies known dangerous Bash requests and otherwise makes no decision, leaving normal Codex approval intact.                                         |
| `PostToolUse`                | Runs asynchronously and appends a small JSONL telemetry event after supported local tools.                                                          |
| `SubagentStart`              | Adds a short objective/workstream/non-ownership/return contract only when a declared objective is available.                                        |
| `SubagentStop`               | Records observation only; it does not continue or block a subagent.                                                                                 |
| `Stop`                       | In `CONTINUITY` only, creates one continuation when all positive state conditions hold.                                                             |

`UserPromptSubmit` is intentionally not configured in v1. Hookline does not rewrite prompts or use transcript parsing as a required interface.

## Local state and privacy boundary

Each capsule and JSONL log lives outside the repository under `%LOCALAPPDATA%\\VoyagewrightHookline` (or the platform-local state fallback), keyed by repository identity, Git worktree root, and a hashed session identifier. It is untracked, per-worktree, and per-session; two worktrees cannot share mutable Hookline state. `HOOKLINE_STATE_ROOT` exists only for isolated test/smoke roots.

The capsule carries a small session id, worktree/branch, base/current-main identity, opt-in objective, completed and remaining workstreams, owned paths, non-ownership boundaries, focused test state, blocker state, continuation count, and timestamps. `HOOKLINE_OBJECTIVE`, `HOOKLINE_COMPLETED_WORKSTREAMS`, `HOOKLINE_REMAINING_WORK`, `HOOKLINE_OWNED_PATHS`, `HOOKLINE_NON_OWNERSHIP`, and `HOOKLINE_BLOCKER` are explicit opt-in launch values; no prompt or transcript is mined. Credential-like values in those fields are redacted before persistence.

Telemetry is append-only JSONL containing hashed session/turn/agent identifiers, repository/worktree keys, branch, tool family, operation class, outcome, optional duration, and a short failure code. It never records tool output, raw command strings, prompts, transcripts, credentials, secrets, or Chronicle content. A telemetry failure warns and leaves ordinary engineering unblocked.

## Command and continuation safety

GUARD/CONTINUITY block `git reset --hard`, forced `git clean`, broad `git checkout -- .` / `git restore .`, broad recursive repository removal, force pushes, destructive canonical-data removal, and database-drop patterns. An ambiguous command that appears potentially destructive is denied rather than guessed. This is a supplemental local guardrail, not a complete enforcement boundary.

Stop always remains possible. A continuation requires all of: `CONTINUITY` mode; trusted, non-corrupt state; an explicit active objective; named locally attainable remaining work; no owner-required blocker; `stop_hook_active` false; and unused budget. Missing, stale, corrupt, unknown, completed, or exhausted state permits stopping. The generated reason names only the already-declared remaining work and forbids additional scope.

## Known limits and rollback

Hooks run only where Codex supports the local function-tool path; hosted tools are outside this coverage. Hookline does not inspect a transcript, infer unlimited work from a dirty tree, auto-approve shell escalation, publish telemetry, or integrate Bridgewatch in this increment. A transient local-state failure disables automatic continuation rather than reconstructing uncertain state.

To roll back, disable the trusted project hooks through `/hooks` or set `[features] hooks = false` in the applicable local Codex config. Remove the local `%LOCALAPPDATA%\\VoyagewrightHookline` directory only when its retained local capsules are no longer needed; it is not repository content. Re-enable only after reviewing the exact tracked hook hash again.

## Candidate acceptance record

The candidate’s deterministic fixture acceptance is `node --test tests/hookline/hookline.test.mjs`. It covers startup/resume/compact, compaction lifecycle, session end, safe/blocked/ambiguous Bash, successful and failed telemetry, bounded subagent context, advisory subagent stop, all required Stop outcomes, PermissionRequest fall-through/denial, corrupt state, privacy redaction, and parallel worktree/session isolation.

Fresh trusted-Codex-session acceptance, candidate push/PR, ordinary Sounding Line, protected merge, and landed-tree smoke remain release-stage evidence and must be recorded only after they occur.
