---
name: launch-task
description: Launch an explicitly requested VoyageWright implementation chat in its Codex project, with a compact Goal prompt, standard title, duplicate checks, and relay cleanup. Also prepare a launch when native tools are unavailable.
---

# Project Launchdeck

Turn the user's agreed project or phase into one implementation chat. A request to draft a prompt alone does not authorize creation. Carry forward settled decisions without asking again. Ask only for missing information that changes the objective, route, or authorization.

The intended entrypoint is a regular ChatGPT **Chat inside this same desktop app**, creating a native **Work chat** in VoyageWright. Use the app's supported host integration. No browser, website, standalone API session, or external Chat-to-Work bridge is part of this workflow. `requires_local_executor` is declared; verify actual native tools in the invoking chat rather than assuming that setting grants them.

## Route and prepare

- “VoyageWright project” means the **VoyageWright Codex project**, unless the human explicitly says otherwise. It never means the current ChatGPT project. Resolve it from live `list_projects`; the verified routing hint is in [native integration](references/native-integration.md). Never substitute Date Nights or a cloud project.
- Use available native host tools; this package supplies skills and deterministic helpers, not a new Codex connection. Check tool availability on every host. Read the integration reference before dispatch or recovery; load only its needed sections.
- The plugin belongs to `Kgray44/treasurehuntSoT` at `.agents/plugins/project-launchdeck`. It may use **all task-relevant accessible content** in the VoyageWright Codex project and that GitHub repository, without a file/folder allowlist. Read [full project and repository access](references/project-access.md) when gathering context. Project Trim limits initial loading, never access or necessary expansion.
- Gather the accepted objective, initiative names, phase if applicable, scope, acceptance criteria, source references, and explicit gates. Do not perform the implementation in the launching chat. Load only relevant source passages; do not copy a whole conversation or governing document.
- Apply the bundled [Project Trim](../project-trim/SKILL.md) to the prompt. Preserve facts, exact paths and identifiers, exclusions, and approval gates. Include references the target can actually access. A local worktree cannot automatically access ChatGPT uploads or synced mirrors; transfer only requested, necessary context using available file tools, or include the essential source excerpts.

## Name and deduplicate

- Phase title: `<Initiative> Phase <number>: <Phase Name>` from current governance. Otherwise use `<Initiative(s)>: <Purpose>`, e.g. `Crossdeck + Parallax: Corrections`. Never put VoyageWright in a new title. Preserve meaningful initiative names and phase numbers.
- Match titles case-insensitively after whitespace normalization. Use the base title if free, otherwise append ` V2`, then the lowest available ` V3`, etc. Check both active and archived chats in the destination project. Do not rename existing owner chats.
- Freeze the trimmed request before dispatch. Use `scripts/launchdeck.py` to plan and reserve a request in the single owner-local journal outside this plugin and synced files; see [helper contract](references/helper-contract.md). The fingerprint preserves exact accepted text, including case-sensitive identifiers, and covers route and scope, not just the title. Reuse the frozen request and same key for retries; reconcile prior markers before rebuilding a changed request. An explicit new run gets a new human-authorized `new_run` value.
- A matching active request is reused without dispatching again. For an idle verified task, an explicit repeat/resume request authorizes native continuation in that same chat with its original scope. Read its initial turn to verify the marker, route, and requirements before sending the concise continuation. Do not restart an accepted/completed phase merely because its title matches. A pending or uncertain reservation must be reconciled before any retry. A title match alone is not proof of a duplicate.
- Journal reservations serialize launches through this helper. Native creation has no transaction or idempotency parameter: inspect again immediately before creation, then verify the returned title. Incomplete inventories or independent launchers limit global guarantees; report them accurately.

## Dispatch, verify, finish

1. Prepare a concrete prompt and reserve before the single native `create_thread` call. Use the verified project ID, selected title, and full prompt. The owner's parallel-launch addendum authorizes independent worktrees for simultaneous implementation launches; require separate task resources and inspect real phase dependencies. For other launches use the requested environment. Omit model, effort, and starting branch unless requested. Do not create relay chats as a convenience.
2. Prepend `Launchdeck request: <request_key>` to the prompt. When a Goal is requested (the usual launch), instruct the target: “Create a native Goal for the objective below before implementation; omit token_budget unless the human specified one. If unavailable, report Goal unavailable and proceed with the authorized task.” Never claim Goal creation just because the prompt requests it.
3. Record returned IDs immediately. A `clientThreadId` is pending setup, never a ready `threadId`. Resolve setup using the returned operation and native status tools. Wait for initial target progress; verify actual project, title, marker, and native Goal evidence. Repair only this newly created chat's title if the host rewrites it or a race causes a collision. Never dispatch a second chat to repair the first.
4. Archive a temporary relay only if this launch created it, its implementation chat is verified, and it contains no unresolved work or approval. Track relay IDs explicitly. Leave the source discussion, implementation chat, existing chats, and worktrees intact. Cleanup failure does not justify relaunching.
5. Report a short status with the exact title, destination, ready/pending/reused state, Goal evidence, and any remaining limitation. Emit the host's created-thread directive for each newly created ready or pending chat when supported. Creation is not implementation completion.

If launch capability, routing evidence, necessary source access, or retry reconciliation is missing, deliver a **READY TO LAUNCH** title, route, and complete prompt in one copyable block. State the exact missing capability once. Do not invent tool endpoints, launch a wrong-project substitute, modify global permissions, start a server, or create a cloud relay automatically. No launch is authorized merely by installing this plugin.

For acceptance or integration testing, read [acceptance contract](references/acceptance.md). Keep source-conversation, installed-plugin, native-host, creation, Goal, naming, parallel-resource, and end-to-end results separate. A ready prompt, app-server/API session, or a call made by another host is not proof of a ChatGPT-to-native-project launch.
