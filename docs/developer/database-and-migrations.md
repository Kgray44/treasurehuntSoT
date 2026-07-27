---
title: Database and migrations
audience: developer
status: current
canonical_for: database-migrations
last_reviewed: 2026-07-27
---

# Database and migrations

Prisma schemas support local SQLite and deployment MySQL paths. Generate the matching client for the active schema and apply migrations in their reviewed order. Treat schema migrations as operational changes: rehearse against a disposable copy, back up the target, and verify role workflows after application.

Do not change provider URLs or execute migrations against an unknown database. See [reference commands](../reference/commands.md) and [upgrading](../administrator/upgrading.md).
