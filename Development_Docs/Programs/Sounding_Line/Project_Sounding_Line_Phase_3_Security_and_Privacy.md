---
title: Project Sounding Line Phase 3 Security and Privacy
audience: engineering
status: current
---

# Security and privacy

Historical payloads use canonical digests and transaction boundaries. Ingestion rejects credential-like field names and values, protects against conflicting receipt replay, and keeps stores, journals, and logs outside worktrees. IDs are constrained; runtime log entries are bounded and reject secret-like material. No browser trace, raw environment, database row, private Chronicle content, or provider credential is committed.
