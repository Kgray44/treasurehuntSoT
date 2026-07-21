# Project Wayfarer Phase 1 Integration Manifest

Status: **draft; no integration, commit, or push performed**.

| Field                        | Value                                                  |
| ---------------------------- | ------------------------------------------------------ |
| Base SHA                     | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`             |
| Latest fetched `origin/main` | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`             |
| Branch                       | `codex/project-wayfarer-phase1-unified-identity`       |
| Ending SHA                   | not created - worktree has uncommitted Phase 1 changes |

## Current branch files

- `prisma/schema.prisma`, `prisma/schema.sqlite.prisma`
- SQLite and MySQL Wayfarer migrations
- canonical account lifecycle and HTTP helpers
- canonical/legacy Player and Captain session adapters
- Player invitation guest-account adapter
- the five required Wayfarer implementation records

## Integration order when the branch is complete

1. Rebase is not authorized; first compare this branch against the then-current `origin/main`.
2. Resolve Prisma schema/migration ordering before merging any code that assumes `UserAccount`.
3. Apply the migration on a disposable database and run reconciliation before enabling canonical adapters.
4. Merge application/auth adapters with concurrent Player, Captain, Creator, invitations, and Studio work in one reviewed integration.
5. Run the full isolated validation gate and inspect all privacy/security tests.

## Known conflicts and risks

`prisma/schema.prisma`, `prisma/schema.sqlite.prisma`, `src/lib/security.ts`, `src/platform/auth.ts`, and `src/platform/invitations.ts` are shared high-conflict files. The branch has not been compared against a newer main because remote main had not advanced at the final fetch. Actor canonical foreign-key changes, reconciliation tooling, acceptance tests, and user-facing pages are still required before this manifest can recommend merge.
