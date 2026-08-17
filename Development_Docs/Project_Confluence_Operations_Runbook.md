---
title: Project Confluence Operations Runbook
audience: engineering
status: current
canonical_for: project-confluence-operations
last_reviewed: 2026-08-17
---

# Project Confluence operations

Set `CONFLUENCE_ARCHIVE_PATH` to a local checkout of the verified-private archive. The workers verify its privacy before every private operation.

| Time (America/New_York) | Actor   | Command / outcome                          |
| ----------------------- | ------- | ------------------------------------------ |
| Daily ~01:00            | ChatGPT | Human Log (external integration)           |
| Monday ~02:30           | ChatGPT | Weekly Human Record (external integration) |
| Monday 03:15            | Codex   | `npm run confluence:collect`               |
| Monday ~04:30           | ChatGPT | Master Journal (external integration)      |
| Monday 07:00            | Codex   | `npm run confluence:deliver`               |

Manual operations use the exact same code paths:

```text
npm run confluence:collect -- --week 2026-W34
npm run confluence:status -- --week 2026-W34
npm run confluence:replay -- --last-7-days
npm run confluence:resume -- --run <run-id>
npm run confluence:deliver -- --week 2026-W34
```

If privacy cannot be verified, the worker fails closed. If human evidence is absent, replay creates `requests/human-replay/<run-id>.json` and stops at `WAITING_FOR_HUMAN_EVIDENCE`. If a master is absent, delivery reports `WAITING_FOR_MASTER`; if publication safety is not `SAFE_TO_MIRROR_EXACT`, it reports `PUBLICATION_BLOCKED`. Neither worker writes literary prose or performs redaction.
