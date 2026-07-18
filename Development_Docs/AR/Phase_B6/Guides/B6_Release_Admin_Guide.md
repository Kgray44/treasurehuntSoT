# Administrator and release guide

## Build environment

- Windows x64; Node 22 or newer and npm 11; repository lockfile required.
- Run `npm ci --no-audit --no-fund`, then `npm run validate`.
- Confirm `npm audit --json`, `npm ls --all --json`, the license review, and the NO-GO dashboard.
- Build through `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1 -Channel development`.

Channels are `development`, `creator-preview`, and `stable`; feature status remains separate. Preview/stable require `WINDOWS_SIGNING_PFX_PATH` and `WINDOWS_SIGNING_PFX_PASSWORD`. Keep the PFX outside the repository. The script maps it to electron-builder, builds NSIS, requires valid timestamped Authenticode, creates provenance/release metadata, and emits SHA-256 sums. Development output is named `unsigned-development` and is not publishable.

## Publication and rollback

1. Verify the persisted release has no open release-blocking issue and that all governing gates have evidence.
2. Publish only canonical signed metadata and matching artifacts over HTTPS.
3. Pin channel, platform, architecture, key ID/trust scope, version, size, hash, and rollback target.
4. Defer installation while a scan/story is active.
5. Stage to the application-owned update directory, verify, atomically activate, then run the health check.
6. On health failure or interrupted startup, restore the prior version state. Never move or delete Creator projects, the database, published packages, or history.

## Database, backup, and restore

SQLite migrations are ordered under `prisma/migrations`; MySQL SQL is ordered under `prisma/mysql-migrations`. Back up the database and application-data/project directory before upgrade. Test restoration to a separate path. B-6 adds metadata/tables without dropping historical data. Rolling application code back to B-5 does not remove B-6 columns; restore the pre-upgrade database backup only if an approved recovery specifically requires schema rollback. Never use a destructive reset on production data.

## Current prohibition

Do not publish `0.8.0-b6`. It is unsigned, has nine open release blockers, has no clean-machine matrix, and lacks the required Rare/Microsoft clarification.
