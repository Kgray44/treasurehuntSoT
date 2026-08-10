---
title: Database and migrations
audience: developer
status: current
canonical_for: database-migrations
last_reviewed: 2026-08-09
---

# Database and migrations

Prisma schemas support local SQLite and deployment MySQL paths. Generate the matching client for the active schema and apply migrations in their reviewed order. Treat schema migrations as operational changes: rehearse against a disposable copy, back up the target, and verify role workflows after application.

Do not change provider URLs or execute migrations against an unknown database. See [reference commands](../reference/commands.md) and [upgrading](../administrator/upgrading.md).

Project Admiralty Phase 1 reserves additive SQLite migration
`20260809120000_admiralty_phase1_foundation` and MySQL migration
`0052_admiralty_phase1_foundation`. They add privileged assurance, Support
Access request, and Support Access grant records plus canonical relations; they
do not rewrite or delete existing rows. Rehearse with
`npm run admiralty:migrations` against task-owned databases, then back up and
verify the authorized target before applying either production-provider path.
Local SQLite rehearsal does not prove production MySQL execution.

Project Tideglass Phase 2 reserves the next additive pair:
`20260809130000_tideglass_phase2_creator_annotations` for SQLite and
`0053_tideglass_phase2_creator_annotations` for MySQL. They add only the
append-only `TideglassCreatorAnnotation` revision model and its relations,
constraints, and indexes. They do not backfill guessed notes or persist
comparison caches, projections, raw snapshots, Player history, or live Voyage
state. Run `npm run tideglass:migrations:sqlite` for the task-owned SQLite
upgrade rehearsal. Production MySQL still requires a separately configured
disposable rehearsal before application to an authorized target.
