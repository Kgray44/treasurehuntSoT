---
title: Command reference
audience: reference
status: current
canonical_for: command-reference
last_reviewed: 2026-08-09
---

# Command reference

| Command                                                                                                             | Purpose                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                                                                                       | Start local development.                                    |
| `npm run lint`                                                                                                      | Run lint checks.                                            |
| `npm run typecheck`                                                                                                 | Check TypeScript.                                           |
| `npm test`                                                                                                          | Run unit tests.                                             |
| `npm run build`                                                                                                     | Build the application.                                      |
| `npm run docs:validate`                                                                                             | Validate documentation governance.                          |
| `npm run private-content:scan`                                                                                      | Run the private-content scanner.                            |
| `npm run tideglass:compare -- --account <account-id> --chronicle <id> --from <edition-id> --to <edition-id> --json` | Run the authorized, read-only Tideglass edition diagnostic. |
| `npm run validate`                                                                                                  | Run the complete repository gate.                           |

Database and private-content commands require an explicitly selected, authorized environment. See [database and migrations](../developer/database-and-migrations.md).

The Tideglass command is a trusted local development diagnostic. It requires an exact canonical account, Chronicle, and two immutable edition IDs; it emits a redacted server projection and never a raw snapshot. It is not an ordinary product route or a substitute for Sounding Line acceptance.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; this branch is not merged or deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes governed Profile imagery, six-digit verification, Resend plus task-owned synthetic email, canonical workspace entry separated from resource authority, route crossfades, account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed.
