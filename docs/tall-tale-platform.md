# Tall Tale Platform

## Product surfaces

`/` is a cinematic three-role gateway. Choosing Player, Captain, or Creator selects a workspace; it never grants a permission. Server sessions, capabilities, scoped assignments, playthrough membership, and exact resource ownership remain authoritative.

- `/player/sign-in`, `/player/invitation`, `/player/library`, `/player/playthroughs/[id]`, and `/player/playthroughs/[id]/archive` provide durable Player identity, code/link acceptance, waiting state, live continuation, and historical records.
- `/captain/sign-in`, `/captain/library`, `/captain/invitations`, `/captain/sessions/[id]`, and Player-safe preview routes provide operational voyage control without exposing Creator-only internals.
- `/studio/sign-in`, `/studio/library`, and `/studio/tales/*` remain the authoring, validation, asset, version, fork, and publishing workspace.
- `/tales`, legacy token sessions, `/quartermaster`, and the original companion remain compatibility surfaces.

The gateway may offer a remembered-session continuation, but every destination repeats authorization. Workspace switching links never upgrade the current account.

## Domain and lifecycle

`TallTale` is the authored identity. `PublishedTaleVersion` is an immutable checksummed snapshot. `TaleSession` is the playthrough aggregate and stores the exact `publishedVersionId`, Captain assignment, configuration, schedule, state, concurrency token, runtime pointers, inventory, and ordered events.

`PlayerProfile` and rotating `PlayerIdentitySession` records provide durable identity. `PlaythroughMembership` associates each Player with one playthrough and carries invitation/ready/active/completed/declined/removed state plus per-Player pin/hide preferences. `Invitation` stores only token/code/PIN hashes and safe prefixes; `InvitationEvent` records lifecycle. `RevealState` records content actually revealed. `PlatformRoleAssignment` supplements existing staff capabilities. `PlatformAuditEvent` records resource actions with correlation IDs and secret-filtered metadata.

Supported playthrough progression is `DRAFT_SETUP -> INVITING -> READY/SCHEDULED -> ACTIVE <-> PAUSED -> COMPLETED`, with cancellation before launch and abandonment after launch. Memberships move through invited, accepted, ready, active, and completed or terminate as declined/removed. Invitation links and codes move through created/sent/copied/viewed into ready/consumed, or terminate as declined/expired/revoked/replaced. Terminal transitions do not reopen in place.

## Invitations and crew launch

The Captain wizard selects an exact published version, configures progression/hints/side quests/schedule/accessibility, adds one or more Players, chooses PIN/account/lifetime policy, reviews Player-safe content, and creates the playthrough plus all membership/invitation records in one transaction. Each crew member receives a distinct high-entropy link, QR code, human short code, and copyable message. Full secrets are returned only by creation or replacement responses and are never listed again.

Link and code resolution is rate-limited. The pending invitation is held in a short-lived HttpOnly SameSite cookie with its own CSRF token. Acceptance atomically claims one redemption, binds or creates the Player identity, readies membership, records invitation/audit events, and readies the playthrough only when no invitation remains pending. Safe retries of an already accepted credential return the existing membership. Expired, declined, revoked, and replaced credentials are rejected before protected content is rendered. Account-required invitations can target only an existing claimed Player and must be accepted while signed into that exact profile.

Launch requires an assigned Captain, a ready/scheduled playthrough, at least one ready Player, the expected concurrency version, and a playable entry block. It promotes ready memberships, consumes accepted invitations, appends ordered launch/block events, records reveal state, and pushes sanitized realtime progression. The waiting room polls canonical state as a fallback and opens the runtime only after persisted launch.

## Projection and authorization rules

Player projections are allowlists. They contain current Player-safe Tale copy, revealed blocks/assets, crew readiness, and exact edition metadata; accepted answers, Captain instructions, Creator notes, future branches, private variables, storage keys, and raw event payloads are removed. Completed archives are rebuilt from the pinned published snapshot plus visited events/reveal state, not from the current draft or latest release.

Media reads require one of four explicit scopes: authenticated Creator asset management; Player membership in the exact version-bound playthrough plus reveal/role inclusion; pending invitation cover access; or the current public catalog cover. Original downloads require asset-management permission. SSE authenticates before streaming and periodically rechecks membership, emitting an access-revoked close signal when authorization changes.

All cookie-authenticated staff and Player mutations require CSRF, except legacy compatibility runtime cookies whose SameSite boundary and opaque session token are retained. Login, invitation-code lookup, Player actions, uploads, and helper endpoints are bounded by rate limits. Identity and invitation secrets are cryptographically random, stored only as hashes, sent through HttpOnly Secure-in-production cookies where applicable, and rotated/revoked on session replacement or logout. Audit metadata rejects secret-, answer-, snapshot-, payload-, and private-note-bearing fields.

## Migration, backfill, and rollback

SQLite migration `20260718020000_tall_tale_platform` and MySQL migration `0004_tall_tale_platform` are additive. They add platform fields and tables without rebuilding `TaleSession`, so existing IDs, version bindings, event sequences, access hashes, inventory, variables, and timestamps remain intact. The progress-preserving seed path creates missing development Player/staff assignments and backfills only non-preview sessions without memberships. Each gets a placeholder Player membership mapped from the existing session state, a voyage/launch value derived from existing fields, and block reveal records derived from historical `blockEntered` events. It does not reset campaign or Tall Tale progress.

`scripts/verify-platform-backfill.ts` creates a legacy-shaped proof row in the disposable validation database, runs normal `--ensure`, then proves identity, event, version, membership, reveal, and timestamp preservation. `scripts/verify-database.ts` additionally checks published checksums, scoped development roles, membership coverage, exact version relations, and audit metadata.

There is no destructive down migration. Before production migration, back up the database and asset volume and verify restore. Rollback is application rollback plus restoration of that matched backup. The MySQL SQL is maintained for production parity, but a live MySQL integration environment is still required before production rollout.

## Validation

Unit tests cover playthrough/membership/invitation state rules, scoped authorization, and audit redaction. The Chromium mutation journey forks and publishes a Tale, creates and accepts an invitation, denies cross-role access and missing CSRF, launches, publishes a newer edition, proves the live session remains pinned, completes the Tale, validates the exact-version archive, persists pin/hide preferences, proves idempotent acceptance, and verifies replacement/revocation. The reduced-motion responsive gateway and authorization denials also run as a read-only mobile WebKit check. The repository release gate remains `npm run validate`.
