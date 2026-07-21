# Project Wayfarer Phase 1 Migration Runbook

Status: **not approved for production execution**. The additive SQLite migration has been rehearsed against the disposable validation database. The MySQL migration and canonical actor cutover remain incomplete and must not be run in production.

## Preconditions

1. Take and verify a restorable MySQL backup.
2. Stop application writers or put the deployment into maintenance mode.
3. Run this branch in a separate isolated database and record source counts for Player profiles, Game Master users, memberships, invitations, invitation events, Creator-owned Tall Tales, Captain-owned Tale Sessions, and sessions.
4. Resolve duplicate-account mappings explicitly. Matching display names or legacy usernames are not sufficient evidence for merging people.

## Rehearsed additive sequence

The tested SQLite migration `20260721120000_wayfarer_unified_identity` creates `UserAccount`, private email/credential/token/session/role/security tables, a migration-record table, and the nullable `PlayerProfile.accountId` relation. It deterministically creates accounts for existing Player profiles and Game Master users, preserves old IDs, copies bcrypt hashes, copies legacy sessions, and supplies Player/Captain/Creator role rows for migrated Game Master users.

The migration was applied only to `%LOCALAPPDATA%\ForeverTreasureCompanion\validation\prisma\validation.db`; the repository harness records and checks the canonical development database family separately.

## Production sequence - blocked pending completion

1. Apply the reviewed MySQL schema migration.
2. Run a bounded, restart-safe backfill command that writes `WayfarerMigrationRecord` for every source record.
3. Reconcile exact counts and inspect every unresolved duplicate candidate.
4. Deploy canonical session and authorization adapters.
5. Enable registration, verification, recovery, session management, and guest claim only after their focused and full tests pass.
6. Backfill canonical actor foreign keys, deploy new-write cutover, then retain raw strings only as historical snapshots.
7. Observe security/claim/session metrics and preserve the legacy tables until a separately approved removal phase.

## Restore and rollback

Do not attempt destructive in-place rollback after application code uses the new tables. Restore the verified backup to a fresh environment, validate foreign keys and source counts, revoke affected security sessions, and redeploy the previous compatible application version. No migration in this branch deletes Player profiles, memberships, invitations, or Game Master rows.

## Current limitations

The checked-in MySQL migration creates the additive canonical tables but intentionally does not yet include the reviewed bounded backfill command. Production use is therefore a NO-GO.
