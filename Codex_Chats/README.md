# Project conversation archive

This directory preserves the visible, project-specific history needed to continue Forever Treasure Companion work across machines. `manifest.json` is the authoritative mapping from a stable source conversation ID to exactly one readable Markdown transcript in `chats/`.

## Sources actually supported

The synchronizer reads local Codex JSONL sessions from `CODEX_HOME/sessions` and `CODEX_HOME/archived_sessions`. These are legitimate local Codex records. It extracts exact visible user messages, visible assistant status/final messages, optional tool calls/results, timestamps, and available attachment names/types. It intentionally excludes developer/system instructions, token accounting, compacted memories, and private model reasoning. Thread titles come from the local Codex session index when available.

It also reads official ChatGPT exports supplied by the user as:

- `conversations.json` (incrementally decoded as a top-level array);
- a numbered conversation JSON file;
- an extracted export directory; or
- a ZIP read safely in place without extraction.

Codex has no direct API here for live ChatGPT Project conversations. This workflow does not scrape browsers, cookies, tokens, credential stores, or protected ChatGPT data. A conversation is never fabricated from memory or a summary. Request a ChatGPT data export from ChatGPT's data controls, then place the JSON or ZIP in `Codex_Chats/imports/`. Raw full-account exports remain ignored by Git.

For ChatGPT message trees, `current_node` is selected when valid and its parent chain is walked to the root. If it is unavailable, the synchronizer deterministically selects the leaf with the latest message creation time (then node ID) and walks that branch. Alternate branches are not merged, which avoids inventing an order.

## Classification

Classification is recorded as included, excluded, or ambiguous. Evidence is evaluated in this order:

1. explicit conversation-ID include/exclude override;
2. exact project or repository identifier in metadata;
3. exact configured workspace-path association;
4. exact project name;
5. multiple distinctive configured project phrases.

A single keyword is only ambiguous, never auto-archived. Generic words such as “treasure,” “pirates,” “website,” “Codex,” “PDF,” or “images” are not configured evidence. Inspect `ambiguous_candidates` in dry-run output or `reports/latest-sync-report.json`, verify the source manually, then add its stable ID to `include_conversation_ids` or `exclude_conversation_ids` in `.codex/chat-sync.json`.

## Identity, updates, and format

Original Codex/session or ChatGPT conversation IDs are preferred. When an export has no ID, a deterministic ID is derived from source type, source identifier, creation time, and the first user-message hash—never from the current time. The manifest retains the original archive path when a title changes, so renames cannot create duplicates. Different IDs remain separate even when titles match.

Visible messages are normalized to UTF-8 with LF endings and insignificant trailing whitespace removed. The SHA-256 in each record covers the normalized Markdown body after redaction, not volatile front matter. Unchanged hashes do not rewrite transcripts, the manifest, or the tracked report. A partial or newer export never deletes an older archive record.

Each transcript has YAML front matter followed by chronological `User`, `Assistant`, `Tool Call`, and `Tool Result` sections. Attachment metadata is listed without inventing attachment contents. `include_tool_output` can disable tools. `include_reasoning` is present for forward compatibility but hidden reasoning is never available to or written by this implementation.

## Privacy and secrets

Changed content is scanned before writing for private-key blocks, provider/API tokens, GitHub tokens, AWS keys, bearer tokens, credentialed database URLs, and explicit secret assignments. High-confidence values are replaced by labeled placeholders and only category counts enter reports. JWT-shaped low-confidence findings stop automatic commit/push for review rather than risking publication. Raw values are never written to reports, manifest metadata, or test snapshots.

Review redacted transcripts and `redaction_categories`; never bypass an unresolved warning. Secret redaction is a defense-in-depth check, not permission to put sensitive account exports in Git.

## Integrated Development_Docs synchronization

The same end-of-task command also inspects the repository-root `Development_Docs` directory as ordinary Git content. It reads porcelain Git status with rename detection, accounts for additions, modifications, renames, deletions, and nested paths, and stages only explicit eligible paths. It does not copy documents into `Codex_Chats` or create a second document store.

Changed documentation is checked against directory-local ignore rules, sensitive filename patterns, bounded textual secret detection, merge-conflict markers, ordinary-Git size thresholds, and existing Git LFS attributes. Suspicious, ignored, conflicted, or unsuitable large files remain local and are reported by path and general reason without printing matched secret values. Deleting a valid tracked document remains eligible so its GitHub counterpart can be removed normally. Unrelated staged and unstaged work is preserved.

## Commands

From any directory on Windows, the wrapper resolves the repository and prefers `.venv` or `venv`:

```powershell
& "<repo>\scripts\sync_codex_chats.ps1" -DryRun
```

If local policy blocks direct `.ps1` execution, use the verified process-scoped invocation (it does not change machine policy):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<repo>\scripts\sync_codex_chats.ps1" -DryRun
```

From the repository:

```powershell
python scripts/sync_codex_chats.py --dry-run
python scripts/sync_codex_chats.py --verbose
python scripts/sync_codex_chats.py --no-push
python scripts/sync_codex_chats.py --source C:\path\to\conversations.json
python scripts/sync_codex_chats.py --report-only
python scripts/sync_codex_chats.py --validate
```

`--dry-run` and `--report-only` do not modify the archive, documents, index, or commits; they do use read-only Git status inspection for `Development_Docs`. `--no-push` permits a local scoped synchronization commit but suppresses the push. Normal mode writes conversation files atomically under a lock, validates the manifest and transcript hashes, commits only explicit eligible archive and documentation paths, fetches before pushing, refuses non-fast-forward or in-progress Git operations, never force-pushes, and verifies the remote SHA. It never resets, cleans, stashes, checks out, or stages the entire repository. Unrelated staged and unstaged changes are preserved.

The tracked latest report changes only when transcript content changes. Volatile per-run diagnostics are stored in ignored `.codex/chat-sync-cache/`, preventing timestamp-only Git noise.

## Automatic finalization and recovery

`AGENTS.md` makes synchronization a mandatory Codex pre-final-response gate because the host exposes no version-controlled completion hook. The final response itself can only be ingested by the next run, when that same session ID is updated. This is an unavoidable ordering boundary, not a claim of live post-response access.

If synchronization fails:

1. read the sanitized error and `.codex/chat-sync-cache/last-run.json`;
2. resolve corrupt input, an ambiguous ID, a secret warning, an excluded documentation path, a concurrent lock, an in-progress merge/rebase, or remote divergence without resetting unrelated work;
3. run `--dry-run`, then `--validate`;
4. rerun normally only after the condition is safe.

Atomic same-directory temporary replacement and rollback protect existing files from ordinary write failures. Orphan `.tmp`/`.bak` files are ignored and never treated as archived records; the manifest remains authoritative.
