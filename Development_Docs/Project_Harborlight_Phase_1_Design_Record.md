# Project Harborlight Phase 1 - Design Record

## Baseline and ownership

- Branch: `codex/project-harborlight-phase1-chart-the-harbor`
- Base and latest accepted integrated `origin/main`: `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`
- Database owner: Harborlight Phase 1. This work does not merge One Voyage (`4e8f385`), Wayfarer (`a478d79`), or Sealed Hold (`4b93b4f`).

## Repository inventory and boundaries

`TallTale` is the canonical authored Chronicle; `TaleDraft` is mutable authoring state; `PublishedTaleVersion` is immutable source content; `TaleSession` is a live voyage; old `Campaign` tables remain production compatibility surfaces. `PlayerProfile` is the currently available canonical person/profile; `PlatformAuditEvent`, `TaleAssetStorage`, `consumeRateLimit`, and the Lanternwake scene registry are existing seams. Harborlight creates no alternate Chronicle, chapter, session, or login identity.

`CommunityListing` is mutable catalog identity and release history. `CommunityRelease` is immutable distribution identity, bound by scalar source ID to an immutable `PublishedTaleVersion`; its manifest, checksum, attribution, license, and spoiler snapshots never change. A later correction creates a new release; listing quarantine/removal controls delivery without rewriting the release.

## Convergence seams

`CommunityProfile.identityKey` plus optional `playerProfileId` represents current Player Profile identity without copying credentials, email, sessions, or Player-only state. During Wayfarer convergence, the adapter maps `identityKey` to `UserAccount` and migrates only the optional compatibility pointer. Chronicle references are source-version IDs, keeping One Voyage terminology/domain ownership isolated. Sealed Hold remains the private encrypted transport authority; Harborlight owns community staging, immutable public/unlisted releases, checksums, and future distribution only.

## Frozen policy

Typed taxonomy has 14 item types with declared release/install/remix/search capabilities. Publication transitions are centralized; visibility is independent; public delivery allows only published COMMUNITY/FEATURED records. Unlisted and private records are never enumerable. Spoilers and private real-world locations are enforced at projection time, not CSS. Public projections are strict allowlists and exclude answers, hidden variables, Captain notes, invitation/session data, private coordinates, email, storage paths, raw drafts, and moderation notes.

Release manifests use schema version 1, canonical JSON SHA-256, semantic versions, required immutable source IDs, license snapshot, and ordered attribution snapshot. License policies support reserved, attribution, remix, noncommercial remix, unmodified redistribution, public-domain-style, and custom keys. Ownership declarations are auditable. Releases retain attribution through profile deletion/deactivation.

Community assets use explicit scan/processing states; `SCAN_NOT_CONFIGURED` is never clean. The local provider separates `staging`, `releases`, and `quarantine`, rejects traversal/absolute/separator tricks, and refuses immutable overwrite. A typed outbox model carries sanitized schema-versioned payloads and idempotency; a future durable dispatcher must set `processedAt` only after success.

Community scenes remain future contracts under the existing Lanternwake Director and inherited reduced-motion/cleanup policies; no scene is production-ready in Phase 1.

## Migration and rollback

Schema changes are additive and use new, unique SQLite/MySQL migration identifiers. No legacy table is renamed, deleted, or repurposed. Rollback is application rollback plus restore of a matched database/asset backup; no destructive down migration is supplied. Phase 2 must add public publishing/review workflow, Wayfarer account relation, durable dispatcher/object storage, and combined convergence tests.
