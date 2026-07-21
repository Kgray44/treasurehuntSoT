# Project Harborlight Phase 1 Acceptance Closure Report

## Recorded closure state

This report records the closure work performed after initial candidate
`c1daa766ec8fe6dba9f0848c2315e6de14e2e1c0`, on the dedicated Harborlight
branch and registered worktree. The canonical checkout was not modified.
The actual ending SHA is intentionally filled in only after the final
documentation commit and push; it must be read from Git rather than guessed.

## Completed repository-local closure work

The closure adds database-backed Community Profile, Listing, and immutable
Release services and CSRF-protected owner routes. The service layer resolves
the existing `PlayerProfile` through an optional relation, never stores
credentials or session data, and keeps the Wayfarer `UserAccount` conversion
behind the documented adapter seam. Releases read the exact
`PublishedTaleVersion` inside their write transaction, persist a canonical
manifest checksum, retain license/attribution snapshots, and never mutate an
existing release in place.

The listing state matrix is now enforced in the service. A creator can submit
the owned intake path only; review, publication, quarantine, removal, and
profile suspension require the future canonical moderation-role adapter. The
public projections remain strict allowlists and do not return source content,
location precision, storage paths, account data, or moderation material.

The outbox now uses an idempotency key derived from the sanitized payload,
atomic persisted leases, retry backoff, and explicit terminal failure state.
SQLite receives an additive table-rebuild migration that preserves data and
adds real foreign keys; no canonical table is changed. MySQL receives the
matching additive foreign-key migration. Lanternwake remains the only motion
authority; its Harborlight scene entries are explicit future contracts, not
production-ready scenes.

## Isolated validation evidence

- Prisma SQLite schema validation passed with `DATABASE_URL` set to an
  isolated validation database.
- TypeScript passed at `f678086fe5b833dcf471e81a47d4249213810174` in the
  local registered validation worktree.
- The complete SQLite migration chain was applied to a newly-created isolated
  database with Python `sqlite3` as a supplementary check. The resulting
  `CommunityRelease` table reported four foreign keys and `CommunityListing`
  reported two. This confirms the SQL migration chain itself, but does not
  substitute for the required Prisma migration-engine gate.
- The final code closure completed all 88 unit-test files / 914 tests in
  54.58 seconds. Vitest emitted only the known jsdom canvas implementation
  notice; it did not fail a test.

## External validation blockers retained honestly

Prisma 6.19.3's Windows schema engine returns only `Schema engine error:`
when `migrate deploy` is run against a new isolated SQLite file, even after
pointing `PRISMA_SCHEMA_ENGINE_BINARY` at the installed executable (which
prints its version successfully). This is an environment/tooling failure with
no actionable diagnostic, not a reason to modify a canonical database.

Next production build was attempted in the local registered validation
worktree. Turbopack correctly rejects its `node_modules` junction because it
points outside that worktree root. The junction target was verified as the
local development runtime; removing it to install a local dependency tree was
blocked by the execution policy. No source dependency lockfile or canonical
runtime was changed.

No isolated MySQL credential set or safe local MySQL client is available.
Existing unrelated EOAT MySQL processes were observed but deliberately never
contacted. Therefore MySQL migration execution is an external environment
blocker; the migration is included and reviewed as additive SQL only.

## Required next acceptance action

Run the supplied migration and build gates from a normal local filesystem
worktree with a real `node_modules` directory, then run the MySQL migration
against a newly provisioned isolated database. Re-run the unit suite after
the final documentation commit. Until those gates are green, this record is a
preserved implementation candidate, not an acceptance declaration.
