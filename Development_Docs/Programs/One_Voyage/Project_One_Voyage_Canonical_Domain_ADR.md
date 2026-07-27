# ADR: Project One Voyage canonical Chronicle domain

- Status: accepted for implementation
- Date: 2026-07-21
- Decision: Chronicle is the production reader and only production writer of authored and runtime state at Stage F.

## Decision

`Chronicle` is the authored aggregate root. A Chronicle has drafts, chapters, blocks, connections, assets, locations, and artifacts. `PublishedTaleVersion` remains the existing physical/version model name during the compatibility release, but represents an immutable **Published Chronicle Version**. It is checksummed, schema-versioned, and never changes after publication.

`TaleSession` remains the live-playthrough aggregate during this compatibility release and represents a **Chronicle Session**. It pins exactly one published version, owns current story position, lifecycle state, monotonic sequence, variables, inventory, reveal state, memberships, invitations, and `TaleSessionEvent` history. Runtime state is mutable only through the canonical command service. A command is idempotent by key and produces one canonical event sequence and one correlated `PlatformAuditEvent`.

The model/table naming compatibility is deliberate and temporary: live application code exposes Chronicle terminology; forward migration preserves installed data and can refer to pre-cutover table identifiers only inside migration SQL. No new feature may create a second authored root or a parallel Campaign writer.

## Ownership boundaries

| Boundary                                       | Canonical owner                                                             | Rule                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Authored content                               | Chronicle, draft graph, assets, locations, artifacts                        | Creator-authorized, mutable only in a draft                               |
| Published content                              | Published Chronicle Version                                                 | immutable snapshot, checksum, schema version                              |
| Live playthrough                               | Chronicle Session                                                           | one pinned version, mutable only through canonical commands               |
| Runtime history                                | Chronicle Session Event                                                     | ordered, monotonic, idempotent command correlation                        |
| Player identity                                | UserAccount, AccountSession, and PlayerProfile                              | account-rooted rotating credential; legacy profile sessions only rotate   |
| Player access                                  | PlaythroughMembership and Invitation                                        | membership is the resource scope; invitation is an acquisition credential |
| Captain / Creator access                       | PlatformRoleAssignment plus existing staff account capability               | explicit role and resource policy checks                                  |
| Artifacts, side quests, map, routes, variables | Chronicle authored definitions plus session variables/inventory/RevealState | definitions are versioned; earned/revealed state is session-local         |
| Presentation acknowledgement                   | canonical session event and RevealState/reading-state projection            | acknowledgement cannot advance story                                      |
| Projection / replay                            | canonical projector from pinned version and events/reveals                  | no CampaignSnapshot read after canonical-read cutover                     |
| Audit                                          | PlatformAuditEvent                                                          | one sanitized record correlated with canonical event/command              |
| Compatibility                                  | `src/compatibility/legacy-companion`                                        | translations only; no independent decisions or state writes               |

## State model

Published content is immutable. Drafts are mutable and never replace a version already bound to a session. A session has `DRAFT_SETUP -> INVITING -> READY/SCHEDULED -> ACTIVE <-> PAUSED -> COMPLETED`, with cancellation before launch and abandonment after launch. Current position is the Session’s current block and current sequence, derived from the last accepted event and persisted projection. Player-visible content is the intersection of the pinned version, membership scope, RevealState, and Player-safe projection policy.

Events are the authoritative history for progression, commands, presentation, and recovery. `variables`, `inventory`, `RevealState`, and current pointers are materialized projections updated atomically with the event. Cached projections may be rebuilt; they are never a second authority. Side-quest completion, artifact ownership, chapter completion, and map/route visibility derive from canonical events and projections.

## Legacy migration and compatibility

`LegacyEntityReference` is the deterministic mapping authority: source domain, model, source ID, canonical model/ID, migration version, source checksum, and timestamps are unique. The runner can resume, reject changed source checksums, resolve legacy URLs, and prove a rerun did not duplicate records. Legacy public slugs are retained by the Chronicle. A valid legacy access code exchanges for a canonical scoped identity/membership; it cannot grant global identity or broaden a role.

Compatibility adapters may translate request/response shape, resolve source IDs, redirect URLs, and exchange old credentials. They call canonical policy, command, projection, and audit services. They may never independently mutate Campaign, chapter, artifact, snapshot, access, command, or audit tables. Stage F is the current default: canonical reads and writes are enabled, and legacy tables are retained only read-only for provenance and bounded adapters.

Phase 2 records privacy-safe compatibility observation outside the authoritative
transaction. It stores operation/disposition/correlation and canonical IDs only,
never credentials or payloads; failed observation cannot block or duplicate a
canonical action. `UserAccount` is the identity root, `AccountSession` is the
only new authentication session, and `AccountRoleAssignment` is role authority.

## Rollout and rollback

Stages are: A inventory/ADR; B migration tooling; C shadow comparison with legacy authoritative; D canonical reads for migrated sessions; E canonical-only writes; F compatibility-only legacy routes and read-only legacy tables; G retirement after removal gates. Feature configuration is typed and stage-specific. The deployed branch default is F; operators can select B/C/D only for isolated migration or rollback rehearsals, never to create a parallel production writer.

Before any canonical-only write, rollback is application routing back to the last authoritative legacy projection after a verified backup. Once a canonical-only event exists, simple pointer rollback is forbidden: use a maintenance restore or reverse projection/reconciliation. Production rollback is not claimed until it is rehearsed against a database backup.

## Deletion gate

Legacy code may be deleted only after: all source models/fields are mapped; a migration and rerun pass; shadow comparison has zero unexplained semantic mismatches; all legacy public links and Quartermaster workflows use adapters; production reachability is zero except named adapters; legacy writers are blocked by tests; the compatibility release has shipped for one full release; and backup/rollback evidence is retained.
