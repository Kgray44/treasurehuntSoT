# Deterministic helper

`scripts/launchdeck.py` is a Python 3 standard-library helper, not an MCP endpoint. It never creates, messages, renames, or archives native chats. It accepts JSON over stdin and writes one compact JSON result. Use the host's known interpreter and the script's resolved path without reading the implementation into context. If execution/filesystem access is unavailable, use the equivalent rules and native request marker, disclose that durable journal deduplication is unavailable; an uncertain retry still must stop.

CLI: `python <plugin-root>/skills/launch-task/scripts/launchdeck.py <plan|reserve|record|status> [--journal <absolute owner-local path>]`. Pass JSON through a file or stdin using safe shell quoting. Do not put prompt text into a shell command string. All launchers for this owner use the same absolute journal: `C:\Users\kkids\.codex\launchdeck-state\launches.json`. Resolve a different owner's Codex data directory once and keep that path stable across chats; never allocate per-worktree journals. The helper locks and atomically replaces the file, waiting at most five seconds for another launcher. Locks never auto-expire; a stale lock requires proving no helper owns it before removing that exact lock file. Never delete the journal as retry recovery.

Plan/reserve input:

```json
{
  "projects": [
    {
      "projectId": "observed",
      "label": "VoyageWright",
      "projectKind": "local",
      "hostId": "local",
      "isGitRepository": true
    }
  ],
  "preferred_project_id": "fd21b701-3215-417a-a413-0a17e02badbb",
  "threads": [
    { "id": "observed", "projectId": "observed", "kind": "codex", "title": "Crossdeck Phase 2: Keep One Deck" }
  ],
  "inventory_complete": false,
  "request": {
    "initiatives": ["Crossdeck"],
    "phase": "2",
    "phase_name": "Keep One Deck",
    "objective": "The agreed concrete outcome",
    "scope": ["Accepted deliverables"],
    "constraints": ["Explicit exclusions or owner gates"],
    "acceptance": ["Observable success criteria"],
    "sources": ["Accessible source reference"],
    "goal": true,
    "environment": "local"
  }
}
```

Required: initiatives, objective, and nonempty acceptance criteria. A phase requires `phase_name` from current governance. `phase` may be omitted for corrections/audits; `purpose` is then required. Arrays contain strings. `environment:"worktree"` also needs `worktree_authorized:true` and a Git destination. `token_budget` must be a positive integer plus `token_budget_explicit:true`; omit both otherwise. `new_run` is omitted for retries; an explicit fresh-run request adds a stable human-authorized value and `new_run_authorized:true`. Freeze the whole request before reservation; exact text, sources, scope, or case changes change the hash. Reconcile existing markers before rebuilding context; changed snapshots are not permission to duplicate an old request.

Project Trim inputs: `context_profile` selects a documented profile; default is product-phase with a phase or bug-repair otherwise. `execution_profile` defaults to STANDARD_AUTONOMOUS; set UNATTENDED_CONTINUATION only when requested. Optional `non_goals`, `deliverables`, and `completion_authority` retain the task's unique boundaries and closure authority. Output includes a labeled adapted short task contract and direct prompt byte/word metrics plus a coarse token proxy. It is not the canonical packet-v2 generator and records actual usage as null/UNAVAILABLE. Never persist its full task_contract/prompt in the journal.

Output includes request_key, title, target, prompt, inventory_complete, and state. `plan` reads a journal if supplied, but does not change it. `reserve` returns `dispatch_once` only for a new reservation or a previously proven `not_created` attempt. All other states return `reconcile_or_reuse` and stored IDs; do not dispatch. Reservations also occupy titles for other requests in the same project.

`record` input: `{"request_key":"ld-…","state":"pending|created|verified|uncertain|not_created","threadId":"…","clientThreadId":"…","operationId":"…","goal_verified":false,"project_verified":false,"title_verified":false}`. Only pass observed IDs and evidence. `verified` requires a threadId, project_verified and title_verified. Goal proof remains a separate flag. `not_created` additionally requires `no_side_effect_proven:true`; it cannot reset created/pending/verified states. Unknown outcomes are uncertain even if the network request failed. `status` takes request_key and returns its existing receipt. Records do not verify native evidence for you.

The journal stores fingerprint, title, route, status, and IDs; it does not persist the full objective/prompt. Keep the prepared prompt in the source discussion or a requested output artifact for recovery. Local files need the owner's normal access protection. There is no background service, polling job, or automatic memory write.

After a native collision repair, `record` may include the observed `title` with `title_verified:true`; it must retain the initiative and phase/purpose and use the base or a V2+ suffix. This updates the receipt without changing the request key or dispatching again. A proven no-side-effect retry reallocates its title against the latest inventory and reservations.

If independent revalidation disproves prior evidence, a verified receipt may become uncertain only with `revalidation_failed:true` and an explicit false project/title/Goal evidence flag. Existing IDs remain immutable and cannot be reset to not_created; subsequent requests reconcile/reuse rather than redispatch.
