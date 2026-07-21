# Project One Voyage rollback runbook

## Preconditions

1. Record application commit, schema migration version, `LegacyEntityReference` checksum report, feature stage, database backup identity/hash, and asset backup identity before enabling canonical reads or writes.
2. Take a consistent database and asset-volume backup. Verify a restore to an isolated database; do not test against production.
3. Run migration `--verify`, shadow comparison, authorization matrix, and restart recovery against the exact release candidate.

## Rollback before canonical-only writes

1. Put the application into maintenance/read-only mode.
2. Disable the typed canonical-read stage for the affected migrated sessions and restore legacy route resolution.
3. Re-enable legacy reads only after verifying the Campaign tables were not changed by adapters.
4. Preserve the canonical mapping and mismatch reports for investigation; do not delete them.
5. Validate Player, Captain, invitation, public-slug, artifact, map, session, and audit projections against the recorded pre-cutover baseline.

## Boundary after canonical-only writes

After a canonical-only command has appended a Chronicle Session Event, directing traffic back to stale Campaign tables is unsafe and prohibited. Select one of these reviewed recovery paths:

- restore the matched database and asset backup during a maintenance window; or
- run an approved reverse projection/reconciliation tool, then compare all semantic state and audit correlation.

Do not claim a simple rollback is available until one path has been rehearsed on an isolated copy and its evidence is linked to the release.

## Verification after recovery

- Confirm the database identity nonce through `/api/dev/validation/database-identity` in the isolated environment.
- Run migration verification in read-only mode and confirm no duplicate mappings.
- Compare current position, sequence, artifacts, side quests, map/routes, presentation acknowledgements, memberships, invitations, session lifecycle, and audit correlation.
- Confirm legacy credentials remain scoped and revoked memberships remain revoked.
- Record the final route stage, application commit, restoration source, and any irreversible canonical events.
