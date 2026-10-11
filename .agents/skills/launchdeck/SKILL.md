---
name: launchdeck
description: Prepare and dispatch an explicitly requested Codex implementation, phase, correction, integration, audit, continuation, or task organization using Project Trim and verified native host capabilities. Ordinary discussion, brainstorming, and document review do not authorize launching.
---

# Launchdeck

Turn the owner's approved context into one correctly organized Codex task. This
repository Skill is the canonical workflow; the Project Launchdeck plugin distributes
the same files. A Skill supplies instructions, not native permissions or APIs.

Read [host capabilities](references/host-capabilities.md) for the calling surface.
Use callable, supported host operations first. The optional v0.4.0 app-server adapter
remains blocked and is not enabled by this Skill update; consult
[its recorded boundary](references/executable-launch.md) only if that adapter is relevant.

## Prepare and route

Launch only on an explicit owner request. A prompt-only request permits preparation;
discussion is not launch authorization. Preserve settled scope and authorizations.
Gather the formal initiative/phase, objective, approved scope, non-goals, governing
sources, dependencies, execution profile, outputs, and acceptance criteria from the
current conversation and accessible sources. Do not implement the phase in this chat.

Apply the existing Project Trim skill: in the repository it is at
`.agents/plugins/project-launchdeck/skills/project-trim/SKILL.md`; in the plugin it is
`../project-trim/SKILL.md`. Read [task contract](references/task-contract.md) for the
small fallback and source bindings when that skill or repository helpers are unavailable.
Read current `AGENTS.md` and relevant `.agents` guidance. Reference permanent governance
instead of copying it into every Goal. Expand context for stale sources or uncertainty;
context optimization never reduces scope or changes Sounding Line authority.

“VoyageWright project” defaults to the existing **VoyageWright Codex Project**, repository
`Kgray44/treasurehuntSoT`, not a ChatGPT Project. Resolve its actual native identity;
never substitute a similarly named project or convert desktop IDs into app-server IDs.
Use [routing and naming](references/routing-and-naming.md). Only ask for a route when
actual ambiguity remains after inspecting available evidence.

## Reconcile and dispatch

For “Continue”, inspect the appropriate existing task, its project, scope, state and
initial context; continue it with the owner's authorized instruction. Do not create a
replacement merely because its title matches. Completed work is not permission to
restart it. For a new task, inspect available active/archived titles and allocate the
base, then V2, V3 sequentially. Disclose bounded inventories.

Freeze the accepted request before dispatch. Use the existing
[planner and durable journal](references/helper-contract.md) via `scripts/launchdeck.py`.
It plans and reserves; it does not launch. Preserve exact request fingerprints and the
single owner-local journal. Retry with the same frozen request; reconcile every pending
or uncertain returned identity before another creation. Missing durable execution/storage
must be disclosed; never blindly retry an uncertain host action.

With a new reservation, call **one** supported native task creation/delegation operation
with the verified project, selected title and full contract. Prefer direct creation.
If the host requires a Work transition or approval, request that supported transition,
carry the prepared context, and continue after actual host approval. Preserve the source
conversation and avoid additional relay tasks. Never fabricate a mode-switch API.
Use local execution by default; preserve explicit worktree/cloud/host intent. Omit model,
effort, starting branch and hard Goal budgets unless the owner requested them.

Request a native Goal for the objective in the target before implementation. Carry
`Launchdeck request: <request_key>` and the full task contract in its initial prompt.
Record returned IDs immediately; pending client IDs are not ready task IDs. Wait for
target progress and independently verify Codex task type, project membership, title,
delivered context, Goal evidence and execution. Repair only the newly owned task's title;
never dispatch another task to repair it. Report any Goal capability gap separately.

## Report the actual result

Classify each surface separately: **FULLY AUTOMATED NATIVE LAUNCH** requires verified
project, title, Goal and execution without extra transition; **SUPPORTED ASSISTED LAUNCH**
requires successful supported delegation after mandatory approval/transition without
manual context copying; **PREPARATION ONLY** means no supported dispatch was available.
An inaccessible surface is **UNVERIFIED**, not passed or failed by another surface's test.
Return an actual task reference when supplied by the host, plus pending/reused/completed
state and limitations. Emit the supported created-task directive after creation.

If dispatch is unavailable, give the prepared title, destination and complete contract,
and name the missing operation. Do not claim creation. Do not alter Gibbs's configuration,
personality, memory, permissions or tasks, install another Dot, or bypass a host gate.
For disposable verification use [acceptance](references/acceptance.md); archive only
verified owned test identities after completion.
