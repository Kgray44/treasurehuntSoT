---
title: Project Helm Phase 1 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-1-design-record
last_reviewed: 2026-08-09
---

# Project Helm Phase 1 design record

## Scope and truth boundary

This record freezes the Phase 1 **Take the Helm** architecture before broad
implementation. The phase is an active vertical slice. It may add the minimal
setup, participation, perspective, authorization, audit, and projection work
needed for a Captain to be an ordinary Player in the same Voyage. It stops
before Phase 2 **Read the Deck** and does not add operational crew intelligence,
Needs Attention, a broad command surface, preflight, recovery, provider health,
or a Helm state store.

| Source boundary               | Frozen value                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Preparation SHA               | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                              |
| Actual branch base            | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                              |
| Branch                        | `codex/project-helm-phase1-take-the-helm`                                               |
| Owned worktree                | `C:\Users\kkids\Documents\treasurehuntSoT-helm-phase1-take-the-helm`                    |
| Project Helm PDF              | version 1.0; SHA-256 `93ae665c95cf117e6d1c1d4c1d4d14245b0c41da6f9ea343977549683982972d` |
| Continuous-development PDF    | version 1.0; SHA-256 `10ba64e3599179814a95d5ee873e3be070a0618fff058506b451dc9666d874a7` |
| Phase brief                   | SHA-256 `07e872b3ed8fe85d75de70e7bb804857e312057e25815c49ce70995296a0b925`              |
| Schema decision               | **NO SCHEMA CHANGE**                                                                    |
| Activation                    | `ACTIVE VERTICAL SLICE`                                                                 |
| Highest pre-integration claim | local implementation and current-source evidence only                                   |

The preparation SHA and actual base are identical. Deepwater and Shipwright
worktrees were present at preflight but had no commit beyond this mainline SHA;
no Wakebook, Admiralty, Drydock, Tideglass, or Helm implementation branch was
present. Reconciliation must be repeated immediately before integration.

## Current authority and membership inventory

| Authority or surface                     | Path and canonical owner                                                                                              | Reads and writes                                                                                                   | Scope, uniqueness, lifecycle, and authorization                                                         | Phase 1 decision                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserAccount`, `AccountSession`          | `prisma/schema.prisma`, `prisma/schema.sqlite.prisma`; Wayfarer/Homeport                                              | Account services create/read account-rooted sessions; route guards read the `wayfarer_account` cookie              | One account may own one `PlayerProfile`; AccountSession is the ordinary authenticated request authority | Reuse unchanged; no Helm account, cookie, credential, or impersonation session                                                                                                                 |
| `PlayerProfile`                          | both Prisma schemas; Wayfarer                                                                                         | Account reconciliation creates missing profiles; Player APIs resolve profile from the account session              | `accountId` is unique; active profile is required for ordinary Player projection                        | Reuse the Captain account's existing active profile; self-participation fails truthfully when none exists                                                                                      |
| Account roles and workspace capabilities | `src/homeport/workspace-capabilities.ts`, `src/homeport/current-user.server.ts`; Homeport                             | Reads account state, role rows, Player memberships, Captain Voyage assignments                                     | Workspace entry is capability; it is not Voyage authority. Current active-Player lock is global         | Preserve the ordinary lock, but exempt Captain entry only when every active membership being exempted belongs to a Voyage the same account captains; Creator and unrelated-Voyage locks remain |
| Voyage-scoped Captain authority          | `TaleSession.captainAccountId` with legacy `captainId`; `src/chronicle/captain-authorization.ts`; One Voyage          | Voyage creation assigns; Captain guards and command services read                                                  | One current Captain reference per Voyage; authorization compares canonical account and legacy bridge    | Reuse; Captain authority and membership are independent facts. No `HelmCaptain` model                                                                                                          |
| `TaleSession`                            | both Prisma schemas; One Voyage                                                                                       | Invitation setup creates; progression and commands mutate lifecycle, sequence, current block, variables, inventory | Canonical Voyage lifecycle and progression source                                                       | Reuse unchanged; participation mode is derived and never stored as `HelmState`                                                                                                                 |
| `PlaythroughMembership`                  | both Prisma schemas; One Voyage                                                                                       | Invitations and direct play create/update; Player Library, Journal, artifacts, history, workspace policy read      | Unique `(playthroughId, playerProfileId)`; status plus join/removal/completion timestamps govern access | Reuse as the only participating-Captain record; self-membership uses the same row and statuses as any Player                                                                                   |
| `Invitation`, `InvitationEvent`          | schemas and `src/platform/invitations.ts`; One Voyage/platform                                                        | Voyage setup creates external-Crew invitation and initial membership; acceptance/revocation changes membership     | Secret-bearing external access ceremony with bounded states and audit                                   | Keep for external Crew. Do not create a fake self-invitation, token, QR code, PIN, or second identity                                                                                          |
| `TaleSessionEvent`                       | schemas and `src/chronicle/progression.ts`; One Voyage                                                                | Progression appends immutable, idempotency-keyed canonical events                                                  | Unique event idempotency key and `(sessionId, sequence)`                                                | Reuse; Captain participation must not create a parallel event stream                                                                                                                           |
| Artifact grant receipt and resolver      | `src/chronicle/artifact-grant.ts`, `ArtifactGrantReceipt`; One Voyage source, Wayfarer projection consumer            | Resolver snapshots eligible memberships at event time; projector reads receipts                                    | Eligibility requires ordinary READY/ACTIVE/COMPLETED membership within joined/removed bounds            | Reuse; Captain capability never enters recipient evaluation. Add tests, not a new engine                                                                                                       |
| Personal artifact projector              | `src/wayfarer/artifacts.ts`; Wayfarer                                                                                 | Reads immutable receipts and membership-bounded legacy evidence; writes personal artifact records                  | Per-profile grant uniqueness and event-time recipient evidence                                          | No Captain special case; prove before/after join and removal behavior                                                                                                                          |
| Personal history projector               | `src/wayfarer/chronicle-history.ts`; Wayfarer                                                                         | Reads membership, published version, canonical events, and participants; writes version-pinned history             | Unique `(playerProfileId, sourcePlaythroughId)`                                                         | Keep membership as eligibility. Filter personal summaries to the membership interval and make member removal outrank later Voyage completion                                                   |
| Presence                                 | legacy `PlayerPresence` is Campaign-only; canonical Chronicle uses `TaleSession.lastHeartbeatAt`; One Voyage          | Session/helper activity writes aggregate heartbeat; Captain cards read aggregate recency                           | No per-member Chronicle presence record exists                                                          | Do not invent pseudo-presence. Membership identifies crew; per-person presence is `UNKNOWN` until a canonical source exists                                                                    |
| Platform audit                           | `PlatformAuditEvent`, `src/platform/audit.ts`; platform                                                               | Services append privacy-safe action records                                                                        | Resource-scoped, correlation-keyed, safe metadata                                                       | Emit distinct Captain-authority and Player-membership actions; never collapse into `ROLE_CHANGED`                                                                                              |
| Captain Library                          | `src/platform/libraries.ts`, `src/components/platform/CaptainLibrary.tsx`; platform/Helm consumer                     | Reads assigned sessions, memberships, invitations, published tales; UI creates/launches Voyages                    | Server authorization comes from canonical Captain workspace and per-Voyage guards                       | Extend with a bounded participation projection, safe self-profile summary, mode selector, change action, and ordinary Player link                                                              |
| Voyage creation                          | `src/platform/invitations.ts`; One Voyage/platform                                                                    | One transaction creates TaleSession, external memberships, invitations, and audits                                 | Current schema requires one or more external Crew drafts; setup assigns Captain authority               | Extend transaction with explicit `captainParticipationMode`; default `CAPTAIN_ONLY`; self row is READY and invitation-free in `CAPTAIN_AND_PLAYER`                                             |
| Captain routes and commands              | `src/app/api/captain/**`, `src/chronicle/captain-authorization.ts`, `captainSessionAction`; One Voyage                | Per-request workspace and resource authority; mutations require CSRF                                               | Captain capability alone cannot operate an unrelated Voyage                                             | Reuse and add one narrow participation mutation; no arbitrary Voyage patch endpoint                                                                                                            |
| Player route authorization               | `src/platform/auth.ts`, `src/app/api/play/sessions/[sessionId]`, Player Library APIs; platform/One Voyage             | Resolves the same account session to profile and then membership                                                   | Membership state, not CAPTAIN capability, grants access                                                 | Reuse; remove stale membership immediately loses Player access while Captain access remains                                                                                                    |
| Player Library and Journal projection    | `src/platform/libraries.ts`, `src/chronicle/progression.ts`, `src/chronicle/journal-contract.ts`; platform/One Voyage | Reads membership and canonical released state; returns allowlisted blocks, events, and assets                      | Player routes never select account role to widen story fields                                           | Reuse and add hostile projection-equivalence tests; Player destination is the ordinary canonical route                                                                                         |

Both Prisma schemas were reviewed. After normalizing the provider and MySQL-only
native type annotations, their 2,966 semantic lines are identical. The existing
models can represent all four required states simultaneously. No migration,
backfill, reservation, or speculative Phase 2 column is justified.

## Frozen Phase 1 decisions

### 1. Captain authority representation

`TaleSession.captainAccountId` is the canonical current authority reference;
`captainId` remains a compatibility bridge for legacy staff records. A Captain
route must still establish the Captain workspace and compare the request's
canonical account to the target Voyage. Assignment and revocation mutate only
these authority references and append dedicated audit evidence.

### 2. Player membership representation

`PlaythroughMembership` remains the only Player participation authority. The
participating Captain uses the `PlayerProfile` already attached to the same
`UserAccount`. Exactly one row is possible because
`(playthroughId, playerProfileId)` is unique. No special membership role,
pseudo-Player, shadow session, or self-invitation is created.

### 3. Simultaneous representation and four-state resolution

The relationships are orthogonal and resolve as follows:

| Captain authority | access-bearing Player membership | state                |
| ----------------- | -------------------------------- | -------------------- |
| no                | no                               | `NO_ACCESS`          |
| no                | yes                              | `PLAYER_ONLY`        |
| yes               | no                               | `CAPTAIN_ONLY`       |
| yes               | yes                              | `CAPTAIN_AND_PLAYER` |

An access-bearing membership is one in `INVITED`, `ACCEPTED`, `READY`,
`ACTIVE_MEMBER`, or `COMPLETED_MEMBER`. Removed, declined, suspended, left, or
otherwise closed rows preserve history but do not create a Player perspective.

### 4. Participation-mode semantics

The typed request contract is:

```ts
type CaptainParticipationMode = "CAPTAIN_ONLY" | "CAPTAIN_AND_PLAYER";
```

It is an instruction to establish or end the ordinary membership relationship,
not persisted Voyage truth. Read projections derive the mode from current
authority plus current membership. A request cannot drift from canonical rows.

### 5. Captain-only creation

The existing creation path remains the owner. Default and omitted mode are
`CAPTAIN_ONLY`. It creates the Voyage, assigns Captain authority, and creates
the existing external-Crew invitation/membership rows, but it refuses any
external-Crew draft that targets the Captain's own profile. It creates no self
membership, Player Library card, Player history, personal artifact eligibility,
or Open Player View control for the Captain.

### 6. Captain-and-Player creation

The same creation transaction assigns authority and upserts exactly one READY
membership for the Captain's current active profile with
`joinedAt = setup time`. The trusted setup source is
`CAPTAIN_SELF_PARTICIPATION`; it creates no invitation secrets. Failure to
resolve or establish the self-membership fails the transaction truthfully and
does not silently downgrade to Captain-only.

### 7. Pre-launch changes

For `INVITING`, `READY`, `SCHEDULED`, and `DRAFT_SETUP`, an authorized Captain
may explicitly add or remove self-participation. Add uses an idempotent upsert;
remove preserves the row as `REMOVED` with `removedAt`. A pre-launch re-add may
reuse the same membership identity and clear `removedAt` because no active
Voyage interval has been split.

### 8. Post-launch changes

For `ACTIVE` or `PAUSED`, add follows ordinary late-join semantics and creates
or activates an `ACTIVE_MEMBER` at the current time. Removal uses the ordinary
canonical removal state and preserves evidence. Rejoining a membership removed
after launch is blocked in Phase 1 because one `joinedAt`/`removedAt` pair
cannot truthfully encode multiple active intervals. Completed, abandoned,
cancelled, expired, and preview Voyages reject changes with a safe reason.

### 9. Late join

Captain authority grants no exception. The same service policy used by ordinary
membership activation decides status. A late join sees no pre-join personal
history summary and receives no earlier personal artifact grant unless the
canonical artifact receipt named that profile at event time—which it cannot do
without eligible membership.

### 10. Player-membership removal

Removal changes only the membership. Captain fields remain untouched. Player
route authorization fails on the next request; Captain authorization remains.
The row, original join time, removal time, events, artifact receipts, and
history projections remain available for governed historical derivation.

### 11. Captain-authority revocation

Revocation clears the scoped Captain references and appends
`CAPTAIN_AUTHORITY_REVOKED`; it does not mutate membership. An active member
therefore resolves to `PLAYER_ONLY`, retains ordinary Player access/history and
legitimate artifacts, and loses Captain projection/commands on the next
request. Phase 1 adds no owner-facing authority-administration UI.

### 12. Account and profile identity

One canonical AccountSession authorizes both workspaces. Player requests map
the account to its unique active profile. No sign-out, second login, incognito
window, impersonation, guest profile, or Helm cookie is used. Captain+Player is
unavailable with a truthful error if the account lacks an active PlayerProfile.

### 13. Player projection contract

Player endpoints authorize membership first and then return the ordinary
allowlisted Player DTO. CAPTAIN capability or Voyage authority cannot widen
the selection. Captain notes, future branches, unreleased hints, raw evidence,
provider state, private memories/reflections, account/security records,
commands, and audit rows never enter the Player payload.

### 14. Captain projection contract

The bounded Captain participation DTO contains Voyage ID, derived authority and
membership booleans, derived mode, safe membership ID, lifecycle state, change
eligibility/reason, Player-perspective availability, and `UNKNOWN` per-person
presence. It does not return ORM objects, email, sessions, provider identity,
private Player content, answer text, device data, Creator draft notes, or Phase
2 operational detail.

### 15. Perspective switching

The Captain card exposes **Open Player View** only when the same account has an
access-bearing membership. It links to
`/player/playthroughs/:id/journal`, which uses the ordinary Player API. Existing
shell workspace navigation returns to Captain context. Perspective is route and
tab state only; it is not stored in TaleSession, and simultaneous Captain and
Player tabs authorize independently.

### 16. Artifact recipient semantics

The existing event-time resolver remains authoritative. READY,
ACTIVE_MEMBER, and COMPLETED_MEMBER rows within joined/removed bounds are
eligible according to the published recipient policy. Captain authority,
creation, and command operation are never proxies. Later join/removal cannot
rewrite prior receipts.

### 17. History semantics

Only membership creates a personal Voyage record. Event summaries are bounded
to `joinedAt <= event.createdAt < removedAt` where those bounds exist. Removed
membership remains removed even if the Voyage later completes. Start time is
the later of Voyage start and join; completion is personal completion or, only
for an eligible member, Voyage completion. Version pinning and participant
snapshots remain Wayfarer-owned.

### 18. Presence semantics

Crew identity comes from ordinary membership. Canonical Chronicle runtime has
only a Voyage-level heartbeat, so the Phase 1 per-member projection reports
`UNKNOWN`; it does not label the participating Captain as a pseudo-role or
infer presence from Captain requests. Captain-only authority creates no crew or
Player presence.

### 19. Idempotency and uniqueness

Creation establishes the self row inside the existing transaction. Mode
mutation requires a bounded idempotency key and optimistic
`TaleSession.concurrencyVersion`; the database uniqueness constraint plus
upsert makes same-key, new-key, reload, and double-submit mode establishment
singular. A repeated already-established request returns the current projection
without resetting join history. Client busy states are feedback, not authority.

### 20. Authorization

Every new mutation requires the canonical Captain session, target-Voyage
authority, CSRF, input validation, rate limiting, optimistic version checking,
and a narrow mode allowlist. Unauthorized and IDOR requests return the current
safe unavailable/forbidden policy without sensitive existence detail. Player
routes continue to authorize membership independently.

### 21. Audit events

The bounded actions are `CAPTAIN_ONLY_VOYAGE_CREATED`,
`CAPTAIN_AND_PLAYER_VOYAGE_CREATED`, `CAPTAIN_AUTHORITY_ASSIGNED`,
`CAPTAIN_AUTHORITY_REVOKED`, `PLAYER_MEMBERSHIP_ADDED`,
`PLAYER_MEMBERSHIP_REMOVED`, and
`CAPTAIN_PARTICIPATION_CHANGE_REJECTED`. Metadata is limited to safe mode,
source, lifecycle, membership ID, and version facts. Authority and membership
changes never share a generic role-change action.

### 22. Schema impact

No schema change. Existing unique relationships, lifecycle fields, audit table,
event table, authority references, and concurrency version are sufficient.

### 23. Migration strategy

No migration, reservation, data rewrite, or backfill. Existing Captain-only
Voyages remain Captain-only unless an actual membership already exists. If a
future requirement needs multiple join/remove intervals, that is a separately
governed additive model decision and is not smuggled into Phase 1.

### 24. API changes

Extend canonical Voyage creation with `captainParticipationMode` defaulting to
`CAPTAIN_ONLY`. Extend the Captain Library response with the bounded projection
and safe self-profile summary. Add only the narrow per-Voyage participation
mutation; do not add a generic patch route. Player endpoints remain unchanged.

### 25. UI changes

Add an accessible setup choice explaining Captain only versus Captain + Player,
include the choice in Review and truthful success/failure text, show current
mode on Voyage cards, expose a confirmed mode-change action with blocked reason,
and show Open Player View only when canonical membership permits it. Motion is
restrained and reduced-motion compatible; no Phase 2 dashboard redesign.

### 26. Backward compatibility

Omitted or unchanged setup remains Captain-only. External Crew invitations,
ordinary Captain creation/launch/command behavior, compatibility authority,
published version pinning, and Player projections retain their existing
contracts. No existing Captain gains membership or history by inference.

### 27. Mainline Safety Contract

See the dedicated contract below. It is part of this architecture freeze and
must be reconciled against current main before integration.

### 28. Phase 2 handoff

Phase 2 may consume the bounded participation projection while building **Read
the Deck** operational intelligence. It may not reinterpret participation mode,
invent presence, widen Player payloads, or require Phase 1 data backfill. Phase
1 stops after integrated acceptance and does not begin that work.

## Mainline Safety Contract

### What exists after Phase 1

- Existing Captain-only operation remains valid and remains the default.
- A Captain may explicitly choose Captain + Player.
- Captain + Player has exactly one normal Player membership.
- Captain authority remains separate and Voyage-scoped.
- Player projection remains ordinary, membership-authorized, and safe.
- Captain projection remains separately Captain-authorized and bounded.
- A participating Captain appears as ordinary crew.
- Artifact and history systems treat the person according to event-time Player
  membership, never Captain capability.
- The ordinary Player route and existing workspace navigation provide
  perspective switching with simultaneous tabs.
- Neither correct mode requires Phase 2.

### What remains unfinished

- Deep operational crew projections and Needs Attention.
- The advanced dashboard, contextual command families, preflight, recovery,
  reconciliation, provider integrations, and participant repair.
- Per-member canonical Chronicle presence and the full Helm responsive/animation
  redesign.
- Captain operational history, archive redesign, and Admiralty escalation.

### Activation state

`ACTIVE VERTICAL SLICE`

The selector and ordinary Player perspective may be active after Phase 1
acceptance. This is not dormant infrastructure.

### Backward compatibility

Default setup is `CAPTAIN_ONLY`. No migration or reconciliation infers a Player
membership from Captain ID, capability, Chronicle creation, Captain route
presence, commands, or audit history. Existing relationship rows remain the
only truth.

### Ownership, dependency, and conflict classes

| Area                               | Canonical owner            | Helm access                                                           | Concurrency class                                       |
| ---------------------------------- | -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Account/session/profile            | Wayfarer/Homeport          | consume; one targeted Captain-lock exception                          | B — coordinated shared contract                         |
| TaleSession/progression/membership | One Voyage                 | extend owning setup service and membership policy                     | B — coordinated shared contract                         |
| Artifacts/history                  | Wayfarer                   | consume and fix only membership-interval defects proven by Helm tests | B — contract consumer with targeted correction          |
| Captain Library and Helm UI        | Platform/Helm              | primary Phase 1 ownership                                             | A — Phase 1-owned surface                               |
| Navigation shell                   | Homeport                   | consume existing workspace links; no redesign                         | C — read-only dependency unless a proven defect appears |
| Sounding Line                      | Sounding Line              | current policy and evidence selection only                            | C — governed consumer                                   |
| Prisma schemas/migrations          | One Voyage/Wayfarer shared | no change                                                             | C — no reservation required                             |

The current Deepwater and Shipwright branches had no commit beyond the base at
preflight. Before integration, Helm must fetch main, inspect all intervening
commits for these surfaces, classify evidence invalidation, and rerun the
current Sounding Line gate on the reconciled source.

### Activation and rollback safety

The change is source-activated through an explicit optional request field whose
default preserves old behavior. Rollback to the prior application remains
compatible because no schema or backfill exists; Captain+Player rows are
ordinary memberships that older code already reads. Rolling back the UI does
not corrupt those rows. Rollback does not delete memberships or audit evidence.

### Permanent-stop test

**YES.**

Captain-only works as before. Captain + Player works completely through
ordinary membership, Player Library, Journal, artifacts, history, and separate
Captain authority. No future Helm phase is required for either mode to remain
correct.

## Implementation boundaries and acceptance

Implementation must remain inside the contracts above. New findings that would
require another authority, identity, membership, progression source, broad API,
schema migration, or Phase 2 UI invalidate this freeze and require redesign
before code continues.

Phase 1 is not accepted by this document, a commit, branch tests, raw Vitest or
Playwright output, a local browser, or a draft pull request. Acceptance requires
current-main reconciliation, the current Sounding Line result, integrated-SHA
proof, canonical-main push, and local/tracking/advertised remote parity.
