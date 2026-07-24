# Project Wayfarer Phase 2 Design Record

Status: contract freeze; implementation follows this record.

## Identity and baseline

- Program: **Project Wayfarer**.
- Phase: **Phase 2: Full Profile and Preferences**.
- Scope: public identity, Chronicle Passport shell, linked providers, typed
  personalization, and granular privacy.
- Branch: `codex/project-wayfarer-phase2-full-profile-preferences`.
- Starting canonical baseline: `origin/main` at
  `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`.
- The branch was created directly from that verified remote ref. It is not a
  continuation of the retired Wayfarer Phase 1 candidate.

## Frozen cross-project contracts

| Concern                                                                    | Canonical owner    | Phase 2 rule                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account, visible person identity, preferences, providers, privacy          | Wayfarer           | `UserAccount` remains private identity root; its one `PlayerProfile` is the canonical person-facing profile.                                             |
| Chronicle and live runtime state                                           | One Voyage         | Phase 2 reads only safe summaries. It creates no parallel Chronicle, session, event, snapshot, or personal-history writer.                               |
| Private packages, scanning, quarantine, and encrypted private assets       | Sealed Hold        | Profile media uses a separate restricted profile-media store and is never represented as a private Chronicle package.                                    |
| Community listings, releases, installation, updates, dependencies, lineage | Harborlight        | `CommunityProfile` remains Community-specific. Its copied display fields are compatibility snapshots, and new public identity projection reads Wayfarer. |
| Scene registration, reduced-motion resolution, and presentation lifecycle  | Lanternwake        | Profile UI uses semantic UI state and system motion preferences; it adds no local GSAP/Rive timeline.                                                    |
| Terminology                                                                | Universal Language | Public page is “Profile”; private hub is “Chronicle Passport”; runtime content is “Chronicle”.                                                           |

## Data and migration reservation

Wayfarer reserves only the assignment supplied for this phase:

| Store         | Identifier                                       | Purpose                                                                                            |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| SQLite/Prisma | `20260722120000_wayfarer_profile_identity`       | Canonical profile fields, profile media, handles, providers, typed preferences, and privacy rules. |
| SQLite/Prisma | `20260722121000_wayfarer_profile_reconciliation` | Additive legacy preference/profile reconciliation and Harborlight compatibility snapshots.         |
| MySQL         | `0013_wayfarer_profile_identity`                 | MySQL equivalent of the Phase 2 identity additions.                                                |
| MySQL         | `0014_wayfarer_profile_reconciliation`           | MySQL equivalent reconciliation/index additions.                                                   |
| MySQL         | `0015_wayfarer_profile_privacy_constraints`      | MySQL visibility and provider/profile constraint indexes.                                          |

The fetched active Phase 2 branches for One Voyage, Sealed Hold, and
Harborlight still resolve to the shared baseline and do not consume these
identifiers. No other project migration range is used.

## Profile and handle contract

- `PlayerProfile` owns display name, optional public handle, biography, status,
  avatar reference, banner reference, and default visibility.
- Handles are normalized using a conservative ASCII grammar
  (`[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?`), stored case-insensitively, indexed
  uniquely, and never derived from an email or login alias.
- Rename history is append-only. A historical normalized handle redirects to
  the current canonical handle unless it is claimed by a later reserved record.
- Account/profile state is checked by every owner mutation and public
  projection. Suspended and deleted profiles cannot be publicly projected.

## Provider contract

- `ExternalIdentity` binds one immutable provider subject to one account;
  collisions fail instead of merging accounts.
- Provider token material is stored only as encrypted-at-rest payload in a
  private field, is never selected by public projection, and is removed on
  unlink.
- Provider visibility and login eligibility are independent.
- The built-in `DISCORD_SIMULATOR` adapter is complete for local and test
  deployments: state, PKCE verifier, nonce, expiry, callback correlation,
  verification, refresh, and unlink are exercised without representing an
  external OAuth approval as production verified. Real Discord configuration is
  opt-in and remains unavailable until client registration is supplied.

## Preferences and privacy contract

- `ProfilePreferenceSet` stores a validated, versioned V1 payload. Application
  code never consumes the legacy generic profile JSON directly.
- Resolution is: mandatory/browser accessibility override, temporary Chronicle
  override, then account preference V1 default. A temporary override is never
  persisted into the account default.
- Visibility is an explicit typed rule per section: `ONLY_ME`, `CREW_ONLY`,
  `REGISTERED_USERS`, `PUBLIC`, or `UNLISTED`.
- The server derives viewer context. Public responses are explicit DTOs; no raw
  ORM profile, account, provider, session, invitation, Community, or private
  content record is serialized.
- Safe defaults keep biography, providers, Chronicle details, crews,
  invitations, security data, and media private until the profile owner changes
  the relevant section.

## Route and reconciliation contract

- `/profile/[handle]` is the stable public projection route. Historical handles
  issue a permanent redirect to the canonical route.
- `/passport` is authenticated and contains Profile, Linked identities,
  Preferences, Privacy, and Security navigation. Future history/artifact tabs
  are labelled as future work rather than simulated records.
- Harborlight keeps its Community status, listing, release, moderation, and
  attribution state. Its public identity projection resolves current Wayfarer
  fields from `CommunityProfile.accountId`; migration leaves existing copied
  fields untouched for historical release readability and stops new duplicate
  writes.

## Security and acceptance commitments

- Owner routes require canonical account session and CSRF for mutation.
- Media accepts only bounded image data, validates magic bytes/type/dimensions,
  creates a generated storage key, and never accepts a caller-controlled path.
- All profile strings are returned as React text and are length-limited; no raw
  HTML biography is accepted.
- The validation suite will include handle race/redirect, public DTO leakage,
  visibility matrix, provider collision/state/PKCE/unlink, preference migration
  and resolution, Harborlight projection, migration foreign-key checks, and
  keyboard/mobile browser coverage.

## Explicitly deferred

Phase 3 personal Chronicle records, timings, endings, memories, keepsakes,
per-person artifacts, achievements, detailed Captain/Creator analytics,
follows/reviews/collections, blocks/reports, passkeys, MFA, export, deletion,
additional provider approvals, and live MySQL deployment proof are not started
by this branch.

## Final continuation decision (2026-07-22)

Repository Playwright Chromium, with an owned loopback server and isolated
resources, is the Phase 2 browser authority. The embedded browser's
`ERR_BLOCKED_BY_CLIENT` occurred before navigation and is environment-specific
only. The focused browser journey proved the real 32x32-or-larger media path,
server-backed privacy projection, provider visibility/login separation, and
confirmation-based unlink; no provider token is projected. The Community
public-listing route's inherited dynamic segment was corrected from `[slug]` to
`[id]` to match its route family without changing Harborlight ownership.

Live OAuth and live MySQL remain deferred external staging/deployment proof;
they do not change the complete Phase 2 implementation classification.
