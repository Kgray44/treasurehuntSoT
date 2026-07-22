# Project Wayfarer Phase 1 Design Record

Implementation status: **in progress / not accepted**. The canonical account schema, migration rehearsal, lifecycle services, and API routes described as implemented below exist on this branch; canonical actor foreign-key cutover, reconciliation tooling, focused tests, full validation, commit, and push do not yet exist. Design decisions in this record are frozen contracts, not claims that every later cutover has been completed.

## Scope and authority

Phase 1, **Establish the Wayfarer**, implements the unified private account and person-facing Player profile foundation for Forever Treasure. It follows `Project_Wayfarer_Player_Identity_Governing_Document.pdf` (v1.0, 2026-07-21) and the Phase 1 implementation brief. It deliberately does not begin provider linking, public profiles, Chronicle Passport projections, artifact ownership, analytics, Community Harbor, passkeys, MFA, export, deletion, or legacy Campaign redesign.

## Preflight (2026-07-21)

| Item                               | Recorded value                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository root                    | `\\\\US-VT-FS01\\Users\\kgray\\My Documents\\treasurehunt\\forever-treasure-companion`                                                                                    |
| Canonical checkout                 | `\\\\US-VT-FS01\\Users\\kgray\\My Documents\\treasurehunt\\forever-treasure-companion`                                                                                    |
| Phase 1 worktree                   | `\\\\US-VT-FS01\\Users\\kgray\\My Documents\\treasurehunt\\Forever-Treasure-Wayfarer-Phase-1`                                                                             |
| Branch                             | `codex/project-wayfarer-phase1-unified-identity`                                                                                                                          |
| Base and fetched `origin/main`     | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`                                                                                                                                |
| Worktree start state               | Clean; no staged, unstaged, or untracked files                                                                                                                            |
| Canonical checkout state           | `work/lanternwake-latest`, behind its upstream by seven commits, with three owner-provided untracked governing PDFs; untouched by this work                               |
| Active visible worktrees           | canonical Lanternwake, Phase 3 command center, Integration, Universal Language, Lanternwake Phase 5, Phase 4 acceptance, and a detached local Phase 5 validation worktree |
| Visible Wayfarer/identity branches | none before this branch                                                                                                                                                   |

`git fetch origin --prune --no-tags` completed before worktree creation. The worktree was created directly from the recorded remote commit. The initial checkout on the UNC share exceeded the normal command window but completed cleanly; no partially-created directory was reused.

High-conflict baseline files were inspected before implementation: `prisma/schema.prisma`, `src/platform/auth.ts`, `src/platform/invitations.ts`, `src/platform/libraries.ts`, `src/platform/policy.ts`, Chronicle authoring/progression services, Captain routes, and Player invitation routes. The base commit contains integrated Lanternwake and Universal Language work; Phase 1 preserves those surfaces rather than restoring older code.

## Frozen architecture

### Canonical person model

`UserAccount` is the private, canonical identity. It has exactly one `PlayerProfile` once claimed and may have multiple active `AccountRoleAssignment` records. A guest is represented by a canonical account with `GUEST_UNCLAIMED` status from the moment invitation acceptance creates a profile. This preferred strategy keeps account and profile IDs stable through claiming, permits canonical guest sessions, and makes guest claiming idempotent.

`PlayerProfile.id` remains stable. `PlayerProfile.accountId` is nullable and unique only as an additive compatibility measure; claimed accounts always have one profile, while a historic unclaimed profile is attached in the migration or invitation flow. A database uniqueness constraint prevents a profile from being attached twice; services enforce the reciprocal one-profile account invariant.

### Login, display, email, and credentials

- `displayName` remains the visible person label, is required for registration and guest entry, is not globally unique, and never defaults to an email address.
- Existing `PlayerProfile.username` is a **legacy private login alias**. It remains usable during the compatibility window but is not newly written by registration and is never exposed as a public handle.
- `AccountEmail` owns a unique lowercase/trimmed `normalizedEmail`, a retained display form, primary and verification state. No email field is included in Player, Captain, or Creator public responses.
- `AccountCredential` is the sole canonical password owner. Existing bcrypt hashes are copied without rehashing; the successful login path may upgrade a legacy hash only with supplied plaintext. New passwords require at least 12 characters and a non-whitespace mix, are bcrypt-hashed, and never logged.
- Email verification and password-reset selectors are random 32-byte URL-safe values. Persistent storage contains only SHA-256 hashes, an expiry, consumption time, and metadata safe for audit. The raw token exists only in the transient transactional-email boundary and test outbox.

### Sessions, CSRF, and security

`AccountSession` replaces person authentication use of `PlayerIdentitySession` and `GameMasterSession`. It stores a hashed opaque token, independent CSRF secret, expiry, last-seen, revocation, and a privacy-safe device label derived from the user agent. Login and password reset rotate/revoke as appropriate. State-changing cookie routes require the session CSRF value; authentication bootstrap endpoints are same-origin JSON endpoints and use strict cookies. Session listings omit token and IP data. Locked and suspended accounts cannot authenticate or use role protections.

`SecurityEvent` records account lifecycle, registration, verification, reset request/consumption, sign-in success/failure, claiming, merge, and session revocation. It never stores raw credential, reset, verification, or session values.

### Roles and legacy Game Master transition

`AccountRoleAssignment` belongs to `UserAccount`, with the global governed roles `PLAYER`, `CAPTAIN`, `CREATOR`, `MODERATOR`, and `ADMINISTRATOR`. Authorization resolves roles from the authenticated canonical account, never from display names, email, or raw legacy strings. `GameMasterUser`, `GameMasterSession`, and `PlatformRoleAssignment` remain read-compatible only for phased data migration. New Game Master identities are forbidden.

Every existing `GameMasterUser` receives a canonical account/profile and receives equivalent roles. A deterministic candidate with a matching legacy Player username is not automatically merged: it is recorded as an unresolved duplicate candidate unless an explicit migration map proves ownership. This protects distinct people who happen to share a name.

### Guest claiming and collision policy

Invitation acceptance creates or attaches a persistent guest account/profile and guest account session. Claiming into a new account adds email and credential in place, verifies the email, converts status to `PENDING_VERIFICATION` then `ACTIVE`, and preserves memberships, invitations, and events.

Claiming into an existing authenticated account is an explicit merge. It moves guest membership/invitation ownership only where the target has no membership for that Voyage. If both profiles have a membership for the same Voyage, the canonical target membership wins and missing timestamps/states are deterministically combined; no duplicate membership is created. The guest account is marked merged, guest sessions are revoked, and both the merge and collision decision are audited. Repeated requests return the same resolved target without duplicating records.

### Canonical actor cutover

The frozen target is that new Chronicle, draft, published version, asset, Tale Session Captain, invitation, invitation-event, reveal, platform-audit, and Tale Session event writes receive optional canonical `actorAccountId` relations. Existing raw IDs remain immutable historical snapshots and compatibility lookups; they must no longer be authorization sources for new code. Actor display snapshots are stored as existing labels or explicit metadata rather than resolved from private email. This branch currently contains the full inventory but has **not** completed that foreign-key/schema/write-path cutover.

Legacy Campaign `ProgressEvent.actor`, `PreparedAction.preparedBy`, and `AdminAuditLog.userId` are inventoried but deliberately not broadly migrated in Phase 1; compatible canonical actor seams are added only where current services write them.

### Transactional email boundary and later seams

Email delivery is a narrow interface with a development/test outbox. Failed delivery does not roll back a correctly-created reset request; it is recorded as a delivery failure for retry/operations. Provider integration receives an account-owned identity seam but no unsupported provider UI or provider connection is added. Typed preferences, public-profile visibility, Chronicle history/statistics, artifacts, and deletion/export retain their current data without being represented as a generic new profile blob.

## Actor-field inventory and disposition

| Existing field                                                                                                 | Current source          | Phase 1 disposition                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `Chronicle.creatorId`                                                                                          | Game Master string      | add `creatorAccountId`; new studio writes use it                                              |
| `TaleDraft.createdBy`, `PublishedTaleVersion.publishedBy`, `TaleAsset.createdBy`                               | Game Master string      | add canonical account relations; retain snapshot strings                                      |
| `TaleSession.captainId`                                                                                        | Game Master string      | add `captainAccountId`; new Captain/preview writes use it                                     |
| `Invitation.createdBy`                                                                                         | Captain string          | add `creatorAccountId`; new invitation writes use it                                          |
| `InvitationEvent.actorId`, `PlatformAuditEvent.actorId`, `RevealState.revealedBy`, `TaleSessionEvent.sourceId` | mixed raw actor strings | add canonical account relation where actor is authenticated; retain historical raw value/type |
| `GameMasterSession.userId`, `PlatformRoleAssignment.accountId`, `AdminAuditLog.userId`                         | Game Master relation    | migrate/mirror into canonical sessions, roles, and audit actor seam                           |
| `PreparedAction.preparedBy`, `ProgressEvent.actor`                                                             | legacy Campaign strings | compatibility-only inventory; no broad Campaign migration in Phase 1                          |

## Migration, reconciliation, and restore

The migration is additive and idempotent. It first creates canonical tables and nullable relations, then runs a transaction-safe backfill in bounded batches. Player profiles receive accounts according to claimed/credential status; unclaimed profiles get guest accounts. Game Master records receive canonical accounts and profiles. Exact identifiers are not merged merely because names match. A `WayfarerMigrationRecord` stores source, target, status, and diagnostic reason, allowing resume without duplicate account or role creation.

The rehearsal runs only against the repository validation database created by the existing isolation harness. It reports examined profiles and Game Masters; created/attached profiles/accounts; credentials, sessions, roles, and actor fields migrated; explicit merges; unresolved candidates; skipped and failed records. Reconciliation compares source memberships, invitations, invitation events, Creator ownership, Captain ownership, and eligible sessions before and after. Production migration requires a verified backup and a successful isolated rehearsal. Rollback is restore-from-backup plus removal of the additive migration only after no application deployment points at it; no destructive in-place rollback is proposed.

## Compatibility boundaries

Player sign-in, invitation acceptance, Captain guards, Creator Studio guards, session-cookie reads, and role policy are adapted to canonical services. During transition they can resolve legacy cookie/session rows to a canonical account, rotate into a canonical session, and preserve existing response shapes. Existing Player, Captain, Creator, invitation, publishing, language, and animation experiences are not redesigned. All private identity data is excluded from existing library and player serializers.

## Test and database isolation contract

Focused tests cover registration, email verification, password recovery, sessions, guest claim/merge, legacy migration, canonical role authorization, actor writes, CSRF, token redaction, and private-response shaping. Migration fixtures assert deterministic counts and ambiguous-name non-merging. The repository validation harness creates an isolated SQLite database, records its identity, and verifies the canonical development database was not mutated. The final gate is the repository-supported `scripts/test-all.ps1` command, run once after focused tests are green; this record and the validation record distinguish task failures from inherited blockers.

## Phase 2 seams (not implemented)

External gaming/social provider connection, account passkeys/MFA, public profile rendering, Chronicle Passport/history projections, typed preference migration, per-person artifact records, derived statistics, Community Harbor, follows/blocks UI, achievement systems, analytics, export, deletion, and legacy table removal remain later phases.
