---
title: Command reference
audience: reference
status: current
canonical_for: command-reference
last_reviewed: 2026-08-09
---

# Command reference

| Command                        | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `npm run dev`                  | Start local development.           |
| `npm run lint`                 | Run lint checks.                   |
| `npm run typecheck`            | Check TypeScript.                  |
| `npm test`                     | Run unit tests.                    |
| `npm run build`                | Build the application.             |
| `npm run docs:validate`        | Validate documentation governance. |
| `npm run private-content:scan` | Run the private-content scanner.   |
| `npm run validate`             | Run the complete repository gate.  |
| `npm run admiralty:validate`   | Validate Admiralty Phase 1 policy. |
| `npm run admiralty:migrations` | Rehearse its SQLite migrations.    |
| `npm run admiralty:journeys`   | Run isolated browser journeys.     |

Admiralty bootstrap is dry-run first:
`npm run admiralty:bootstrap:plan`, then the explicitly authorized
`npm run admiralty:bootstrap:commit`. The owner-runtime controller supports
`admiralty:walkthrough:prepare`, `start`, `status`, `reset`, and `stop`; it
requires `ADMIRALTY_PHASE1_TASK_ROOT` below the local ProjectAdmiralty task
directory. See [administrator bootstrap](../administrator/admiralty-bootstrap.md).

Database and private-content commands require an explicitly selected, authorized environment. See [database and migrations](../developer/database-and-migrations.md).

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; this branch is not merged or deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes governed Profile imagery, six-digit verification, Resend plus task-owned synthetic email, canonical workspace entry separated from resource authority, route crossfades, account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed.
