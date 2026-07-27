---
title: Local development
audience: developer
status: current
canonical_for: local-development
last_reviewed: 2026-07-27
---

# Local development

Install the supported Node.js version, install dependencies, copy `.env.example` to a local uncommitted environment file, and use a task-owned SQLite database or approved development database. Generate the SQLite Prisma client before database-backed browser work, apply migrations, seed only synthetic data, and start the development server.

Use `npm run lint`, `npm run typecheck`, `npm test`, and `npm run docs:validate` during development. Command details are in [reference commands](../reference/commands.md). Never use a shared or production database for local tests.
