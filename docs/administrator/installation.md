---
title: Installation
audience: administrator
status: current
canonical_for: administrator-installation
last_reviewed: 2026-07-27
---

# Installation

Use a supported Node.js runtime and a task-owned database for local setup. Install dependencies with the lockfile, copy the example environment file without committing secrets, generate the appropriate Prisma client, apply the intended migrations, and start the application.

Verify with the health-relevant route and a synthetic account. Do not seed or migrate a shared production database from a development shell. Detailed commands are in [reference commands](../reference/commands.md); configuration is in [configuration](configuration.md).
