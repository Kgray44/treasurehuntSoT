---
title: Local development
audience: developer
status: current
canonical_for: local-development
last_reviewed: 2026-08-07
---

# Local development

Install the supported Node.js version, install dependencies, copy `.env.example` to a local uncommitted environment file, and use a task-owned SQLite database or approved development database. Generate the SQLite Prisma client before database-backed browser work, apply migrations, seed only synthetic data, and start the development server.

Use focused tests, `npm run lint`, `npm run typecheck`, and `npm test` during
development. Before a pull request, run the checks relevant to the changed
area; the Sounding Line final check selects and widens the candidate proof.
Run `npm run features:sync` and `npm run features:validate` only when a product
capability meaningfully changes, never for provenance-only reconciliation.
Command details are in [reference commands](../reference/commands.md). Never
use a shared or production database for local tests.

For LAN or protected-tunnel development, use exact hostnames.
`scripts/start-dev.ps1 -Lan` adds the machine's current LAN IPv4 address to the
process allowlist; add other governed names through
`HOMEPORT_ALLOWED_DEV_ORIGINS`. Run `npm run homeport:origin:test` for direct and
reverse-proxy hydration, interaction, keyboard, navigation, and origin-metadata
regression. The harness creates and migrates a task-owned SQLite database and
never targets canonical state.
