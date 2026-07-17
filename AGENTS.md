# Repository instructions

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
