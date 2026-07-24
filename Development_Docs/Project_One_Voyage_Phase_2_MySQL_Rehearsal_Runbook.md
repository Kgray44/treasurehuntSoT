# Phase 2 MySQL rehearsal runbook

Run `npm run rehearse:one-voyage:mysql` from a local worktree with Node and
MySQL 8 installed. The runner initializes a new MySQL instance beneath the
local application-data rehearsal directory, uses a unique port/schema and a
random runtime credential, and never reads a shared or production schema.

It applies `0001` through `0011` in the documented order; verifies a runtime
credential cannot execute DDL; generates the MySQL Prisma client; inserts a
generic disposable Campaign fixture; runs legacy migration, verify, rerun, and
shadow parity; performs one bounded Quartermaster compatibility command; dumps
and hashes the schema; restores it into a second isolated schema; compares
semantic/audit/observation counts; and restarts the isolated server.

The current live proof used MySQL Community Server 8.0.46, 12 migrations, and
only generic proof data. `0011` is the sole One Voyage Phase 2 migration;
`0012` remains unused. The runner removes its own temporary resources by
default. `-KeepArtifacts` is diagnostic-only and must not be used for release
evidence without a subsequent cleanup run.
