# Host capabilities

Inspect the actual callable operations and their schemas once per invocation. Map
project discovery, active/archived task inventory, creation, continuation, naming,
status, Goal and archive by capability; namespace names alone are not proof.

| Calling surface  | Supported workflow when exposed                                                                                                                   | Evidence required                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex Desktop    | Native `list_projects`, `create_thread`, `wait_threads`, `read_thread`; use `send_message_to_thread` for owner-authorized continuation.           | Independent native project/task readback, exact delivered contract, Goal and execution.                                                                                   |
| Gibbs / Dot      | Use Gibbs's existing selected computer and supported local Codex delegation. Local access can make skills available.                              | Inspect real Dot-discovered Skill, returned local Codex task, project, title, transferred context and result. Do not assume the originating ChatGPT transcript transfers. |
| Ordinary ChatGPT | Invoke bundled Skill through the host's skill mechanism; prefer direct delegation if exposed, otherwise request the supported Work/Codex handoff. | Observe actual handoff/approval, source preservation, target identity and execution. Metadata reads are not Skill invocation.                                             |
| ChatGPT Work     | Use exposed native Codex operations directly. Preserve requested local/cloud destination.                                                         | Work-origin verification; a Desktop test cannot pass this gate.                                                                                                           |

These routes are capability choices within one workflow, not independent launchers.
Missing tools produce PREPARATION ONLY on an accessible surface. If the surface itself
cannot be invoked, mark its live gate UNVERIFIED. Never impersonate Gibbs or ordinary
ChatGPT using a Desktop-origin call. Installation cannot supply absent APIs.

A supported required transition/approval is a host boundary, not a plugin bug. Request
it using the real exposed interface; elapsed time is not approval. If it opens a separate
Work conversation, keep the original intact, carry the prepared contract and minimize
further intermediaries. Report the actual chain and mandatory owner action. Do not claim
single-step automation before observing it. If no transition interface is exposed, name
that absence rather than inventing a tool or asking the owner to copy context as success.

The optional app-server adapter remains `pluginOnlyAssociationVerified:false`. Do not
enable it, infer desktop membership from cwd, convert project IDs, copy native providers,
or restart earlier registration experiments. Supported native host calls are permitted
independently of that adapter. Historical restrictions in native-integration.md describe
earlier requests; this canonical Skill governs the current supported handoff policy.

Official references, checked 2026-10-10: [Skill discovery and invocation](https://learn.chatgpt.com/docs/build-skills),
[Dot local task creation and continuation](https://learn.chatgpt.com/docs/dots/tasks-and-memory),
[Plugin skills](https://developers.openai.com/plugins/concepts/skills).
