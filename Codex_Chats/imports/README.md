# Private import drop

Place an official ChatGPT `conversations.json`, a numbered conversation JSON file, an extracted export directory, or an export ZIP here. Raw exports are intentionally ignored by Git and are read in place; they are never copied into the archive.

Run `python scripts/sync_codex_chats.py --dry-run` first. ChatGPT exports commonly lack a reliable project association, so keyword-only matches may be reported as ambiguous. Review `Codex_Chats/reports/latest-sync-report.json` or the dry-run output, then add a confirmed ID to `include_conversation_ids` in `.codex/chat-sync.json`. Use `exclude_conversation_ids` for a permanent exclusion.
