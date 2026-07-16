# Repository instructions

## Mandatory conversation finalization

For every Codex task performed in this repository, conversation synchronization is a required finalization gate. Do not delete or weaken these steps:

1. Complete and test the requested project work.
2. Run `python scripts/sync_codex_chats.py --dry-run` and review included, excluded, and ambiguous classifications.
3. Run `python scripts/sync_codex_chats.py` to ingest every currently accessible project-associated Codex session and any newer export in `Codex_Chats/imports/`.
4. Run `python scripts/sync_codex_chats.py --validate` and inspect the exact archive-owned Git diff.
5. Confirm the command exit status and the structured report. Never say a task was archived unless a source was actually read and a transcript was written successfully.
6. If transcript content changed, confirm the archive-only commit and push were successful and verify the remote SHA. If nothing changed, confirm no empty commit was created.
7. Include one concise `Chat archive:` result line in the final response.

The synchronizer is deliberately not a `post-commit` hook because many prompts finish without a code commit. The Codex host currently exposes no repository task-completion hook that can be versioned here, so this instruction is authoritative. A task's final assistant message can only be captured on the next synchronization because it does not exist until after the pre-finalization run; the next task must update that same stable conversation rather than creating a duplicate.

Do not manually stage the entire repository for chat synchronization. Do not commit raw ChatGPT exports. Do not bypass a secret warning, unsafe Git state, ambiguous classification, source failure, or integrity failure.
