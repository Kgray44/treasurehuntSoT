# Project Confluence worker definitions

Status: staged, not active. The current Codex automation project is the non-Git parent workspace, so activating a standalone worker would not guarantee execution from a trusted, protected-main checkout. Register these definitions only after a Git-backed `Kgray44/treasurehuntSoT` project points to a clean `origin/main` worktree with the Confluence candidate integrated.

## Confluence Weekly Engineering Collector

- Schedule: Monday at 03:15, America/New_York.
- Preconditions: trusted `origin/main`; `CONFLUENCE_ARCHIVE_PATH` names a local archive checkout; archive privacy verification passes.
- Command: `npm run confluence:collect`.
- Owned paths: `engineering/**` plus deterministic `indexes/evidence-index.json` update.
- Failure: fail closed, release the archive lock, and report a concise safe status.

## Confluence Weekly Delivery Worker

- Schedule: Monday at 07:00, America/New_York.
- Preconditions: trusted `origin/main`; private master and manifest exist; design validation passes; publication safety is exactly `SAFE_TO_MIRROR_EXACT`.
- Command: `npm run confluence:deliver`.
- Owned paths: exact public derivative, safe public metadata, and private delivery receipt/index updates.
- Failure: `WAITING_FOR_MASTER` when absent, `PUBLICATION_BLOCKED` when not exact-safe; never redact or rewrite.

Every worker has manual command parity, observes archive locks, and uses the prior completed Monday-Sunday period in America/New_York.
