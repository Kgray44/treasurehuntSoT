# Community Harbor data model

## Authority and relationships

Harborlight is a catalog and distribution domain, not a second Chronicle runtime. `TallTale` remains authored Chronicle identity, `TaleDraft` is mutable Studio state, `PublishedTaleVersion` is the immutable source, and `TaleSession` remains a live voyage. `CommunityProfile` has an optional one-to-one foreign key to the currently canonical `PlayerProfile`; `identityKey` is retained only as a Wayfarer migration seam. Credentials, session data, email, and invitation state are not copied.

`CommunityProfile 1--* CommunityListing 1--* CommunityRelease`; a listing optionally points at its current release, while every release retains its listing history. A release optionally references one `PublishedTaleVersion`, is published by a profile, has ordered attributions, optional ownership declarations, and optional immutable asset references. Assets belong to a profile and may attach to one release. The outbox is independent so it can preserve aggregate events even when a business relationship is later removed.

## Models, constraints, and retention

Profiles have unique `playerProfileId`, `identityKey`, and normalized handle. Listings have globally unique slug and indexed owner/state/visibility. Releases have unique `(listingId, semanticVersion)`, immutable manifest/checksum/source/license/attribution/spoiler snapshots, and indexes for source and chronological history. Assets have unique storage key and `(ownerProfileId, checksum)`; scan and processing state are explicit. Outbox events have unique idempotency key and indexed availability/claim state. License policies have stable unique keys.

Profiles and listings are mutable only through services. Published release payload fields, source identity, semantic version, and snapshots are never updated; deprecation, replacement, and moderation are separate metadata. Removed content stops delivery but retains listing/release IDs, checksums, attribution, ownership declarations, and audit meaning. No hard-delete workflow is provided.

SQLite uses the same model through the Prisma schema; its closure migration adds claim fields but cannot add named foreign keys without a table rebuild. MySQL closure migration applies explicit foreign keys. Before a production SQLite relation hardening migration, back up and perform a table-rebuild migration in an approved window. This is a Phase 1 compatibility constraint, not permission to bypass service ownership checks.
