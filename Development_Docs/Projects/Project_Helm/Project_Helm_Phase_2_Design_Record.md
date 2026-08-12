---
title: Project Helm Phase 2 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-2-design-record
last_reviewed: 2026-08-10
---

# Project Helm Phase 2 design record

## Scope and activation

Phase 2, **Read the Deck**, is an active additive projection upgrade. It makes
the Captain Library and Voyage Console informative without creating a second
Voyage state machine, event store, command engine, or preflight/recovery
system. The actual branch base is
`4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`.

The Phase 2 addendum corrects an initially over-broad repository-context claim:
per-member presence and synchronization are required product behavior, not a
permanent `UNKNOWN` placeholder. Schema impact is therefore the explicitly
justified, minimal additive `MembershipPresenceDevice` relation. It is a
Platform-owned membership/device evidence source and is not a Chronicle
progression, a Helm event store, a device fingerprint, or an authority source.

Phase 1 remains authoritative for Captain-only and Captain + Player behavior.
Phase 2 consumes its scoped authority and ordinary membership facts unchanged.
Phase 3 command redesign and Phase 4 preflight/recovery are expressly out of
scope.

## Governing-document reconciliation

The Helm v1.0 governing document correctly defines the **target** operational
presence model, but its repository-context statement that person-level
heartbeat, active-device, and lag evidence already existed was not fully
supported by the source surveyed during Phase 2. Phase 2 therefore implemented
the missing per-member Platform presence source required to satisfy the
governed Phase 2 product contract. This makes the implementation record
truthful without claiming that the governing target itself was wrong.

## Frozen source-of-truth matrix

| Concern                             | Canonical source                                             | Helm Phase 2 treatment                         |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Captain authority                   | `TaleSession.captainAccountId` with legacy bridge            | request authorization only                     |
| Player participation                | `PlaythroughMembership`                                      | safe crew lifecycle projection                 |
| Voyage lifecycle and sequence       | `TaleSession`                                                | derived operational status and progress source |
| Progression history                 | `TaleSessionEvent`                                           | allowlisted operational event projection       |
| Invitations                         | `Invitation` and `InvitationEvent`                           | lifecycle/readiness facts only                 |
| Verification                        | `TaleVerificationEvent` / existing pending request relation  | bounded warning and request state              |
| Legacy aggregate runtime presence   | `TaleSession.lastHeartbeatAt`                                | compatibility-only; never identifies a member  |
| Member presence and synchronization | `MembershipPresenceDevice` joined to `PlaythroughMembership` | derived current Platform operational evidence  |
| Synchronization                     | canonical session sequence and device acknowledgement        | server-derived event lag/state                 |
| Published progress structure        | immutable `PublishedTaleVersion.contentSnapshot`             | current published section/block only           |
| Needs Attention, status, grouping   | derived in `src/helm/operations.ts`                          | never persisted as canonical truth             |
| Event stream                        | canonical events only                                        | no `HelmEvent` table or raw payload exposure   |

Every outbound Captain DTO is an allowlist. It cannot contain profile/account
entities, email, session/device identifiers, raw event payloads, answers,
private reflection/history, Creator drafts, unpublished content, invitations
secrets, verification media, or administrator/support data.

## Per-member presence source correction

Each Player browser creates a browser-local opaque UUID device-instance token;
it is neither a person identifier nor a cross-site tracker. Authenticated Player
surfaces send bounded heartbeats for their own membership, current safe activity
(`WAITING_ROOM`, `JOURNAL`, or an allowlisted equivalent), and the last
acknowledged `TaleSession.currentSequence`. The server verifies the ordinary
Player session, CSRF token, rate limit, membership id, active membership state,
Voyage scope, and that the acknowledgement cannot exceed the authoritative
sequence. A foreign member, another Voyage, revoked membership, malformed
device id, forged sequence, or unauthenticated request is denied before any
presence row is written.

`MembershipPresenceDevice` is unique on membership plus device instance. A
fresh non-disconnected device produces `CONNECTED`; its greatest valid
acknowledgement produces `SYNCHRONIZED` or `CATCHING_UP`. With no fresh device,
the most recent member evidence becomes `RECENTLY_LOST` then `STALE`; no row is
truthfully `UNKNOWN`. Multiple tabs/devices converge through the max valid
acknowledgement and active-device count. Late/out-of-order acknowledgements
cannot regress the stored high-water mark. Unmount/sign-out sends a best-effort
disconnection, membership removal marks active devices disconnected, and a new
Voyage has a distinct session/membership scope; timeout remains correct if
clean close delivery fails. The writer prunes only its own membership's device
evidence after 30 days and retains at most the eight most-recent device rows;
this bounded cleanup cannot delete Voyage truth or another member's evidence.

The existing `TaleSession.lastHeartbeatAt` remains an untouched compatibility
field. Helm does not derive individual presence from it. Library summaries and
Captain crew rows derive from membership evidence only, expose no raw device id,
IP, fingerprint, request detail, or raw activity payload, and never write or
advance Chronicle state. Current presence changes reconcile through the normal
bounded polling projection and appear as bounded current observations beside
canonical operational events; no high-frequency presence history is fabricated.

## Projection contracts

`CaptainLibraryProjection` returns ordered Voyage summaries and established
Library groups. `CaptainVoyageProjection` returns a read-only operational
header, `CaptainCrewMemberProjection[]`, `CaptainNeedsAttentionItem[]`, a
cursor-paged `CaptainOperationalEventProjection[]`, and a
`CaptainProgressProjection`. Each item names its canonical source through its
source type/id and includes `computedAt`, `sourceUpdatedAt`, and a bounded
staleness indicator.

Routes use the existing Captain workspace and per-Voyage authority guard:

- `GET /api/captain/library`
- `GET /api/captain/voyages/:voyageId`
- `GET /api/captain/voyages/:voyageId/crew`
- `GET /api/captain/voyages/:voyageId/events?cursor=&category=`

They are read-only. They never invoke progression, write `TaleSession`,
membership, event, invitation, audit, or artifact data, and do not broaden any
Player DTO. The separate authenticated Player presence route is the only Phase
2 presence writer: `POST /api/player/playthroughs/:playthroughId/presence`.

## Status, priority, readiness, and attention

The derived vocabulary is `SETUP`, `WAITING_FOR_CREW`, `READY`,
`ACTIVE_HEALTHY`, `ACTIVE_ATTENTION`, `PAUSED`, `DEGRADED`, `RECONCILING`,
`COMPLETED`, `ABANDONED`, and `CANCELLED`. Canonical terminal and paused states
win. Active Voyages with unresolved HIGH/CRITICAL attention become
`ACTIVE_ATTENTION`; unknown data never becomes a negative fact.

Needs Attention is derived from current pending verification, current
invitation/membership readiness, and member-scoped presence/synchronization
evidence where the source permits it. Its stable key is Voyage + condition +
membership/source. A
refresh updates an item rather than creating duplicates. `INFO`, `NOTICE`,
`WARNING`, `HIGH`, and `CRITICAL` are ordered deterministically, followed by
oldest unresolved observation, latest meaningful activity, then Voyage id.
No Phase 2 dismissal persistence is introduced.

Readiness presents existing invitation and membership evidence only. It is not
a Phase 4 preflight engine. A missing membership-presence row remains
`UNKNOWN`; a stale member row is shown as _not currently connected_ for that
safe crew projection, never as a device/IP/fingerprint claim. The legacy
aggregate heartbeat cannot create a member condition.

## Progress, event, realtime, and client reconciliation

Progress maps the current published chapter/block and sequence to a safe,
read-only summary. It does not return future draft content, mutate a graph, or
offer a command action. Operational events are ordered by canonical sequence
and id, cursor-paged, filterable by safe category, and contain a generated safe
summary rather than raw payloads.

The current product has polling-based reconciliation but no authenticated
Captain realtime transport that exposes a Phase-2-safe source. The UI keeps the
existing bounded polling cadence, marks data stale after the declared interval,
and refreshes from the authoritative read endpoint after transport failure.
It must not claim WebSocket delivery. If a future canonical authenticated
realtime channel is adopted, it must reconcile by event sequence and use this
same DTO contract.

Library loading is one bounded Voyage query with relations rather than a
Voyages-times-Crew loop. Crew output is bounded and relation-loaded; events use
cursor pagination. Phase 2 adds no cache because the existing source queries
are sufficient and a cache would add an invalidation contract without need.

## User experience, accessibility, security, and handoff

The Library leads with Needs Attention and deterministic priority; active,
ready, invitation, published, and completed groups retain their existing
roles. The Console leads with status/freshness, attention, crew, read-only
progress, and recent operational history. Long names, large crews, keyboard
navigation, 200% zoom, reduced motion, responsive layout, and semantic
headings/lists are acceptance requirements.

Every projection endpoint requires a valid ordinary account session, Captain
workspace capability, and current Voyage-scoped Captain authority. Player-only,
other-Voyage, revoked, altered-id, and direct requests are denied. The
participating Captain is projected from the one ordinary membership row and is
not duplicated.

Phase 3 may redesign contextual commands and richer progress interaction only
from this projection boundary. It must not reinterpret the status, source,
privacy, or read-only guarantees frozen here.
