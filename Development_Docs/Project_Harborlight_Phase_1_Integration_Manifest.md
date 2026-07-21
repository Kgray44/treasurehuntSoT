# Harborlight Phase 1 Integration Manifest

## Candidate

- Branch: `codex/project-harborlight-phase1-chart-the-harbor`
- Base/latest `origin/main`: `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`
- Ending commit: recorded after final validation and push.

## Additive surface

Models: CommunityProfile, CommunityListing, CommunityRelease, CommunityReleaseAttribution, CommunityLicensePolicy, CommunityOwnershipDeclaration, CommunityAssetReference, CommunityOutboxEvent. Unique constraints: normalized handle, listing slug, listing/version, storage key, owner/checksum, outbox idempotency. Indexes cover profile moderation/visibility, listing ownership/state, release source/version, attribution order, asset release/visibility, and outbox dispatch.

SQLite migration: `20260721140000_project_harborlight_phase1`; MySQL migration: `0006_project_harborlight_phase1`. Environment: `COMMUNITY_ENABLED`, `COMMUNITY_PUBLIC_PUBLISHING_ENABLED`, `COMMUNITY_MODERATION_REQUIRED`, `COMMUNITY_ASSET_STORAGE_PROVIDER`, `COMMUNITY_ASSET_ROOT`, `COMMUNITY_WORKER_ENABLED`, `COMMUNITY_RATE_LIMIT_PROFILE`, `COMMUNITY_PUBLIC_BASE_URL`.

## Convergence risks and order

One Voyage owns canonical Chronicle terminology/domain consolidation; merge it first, then retarget scalar source seams. Wayfarer owns `UserAccount`; next migrate `identityKey` adapter without copying identity secrets. Sealed Hold remains private encrypted package transport and should reconcile only shared checksum/storage utilities. Then run schema migration, public-projection hostile fixtures, IDOR/visibility tests, exact-version release tests, and storage/outbox integration tests on both SQLite and MySQL.

Deferred destructive work: no legacy migration/deletion, no auth replacement, no package import/export, no public upload/publishing, no production object storage/worker. Retained compatibility: Campaign, PlayerProfile, TallTale, and current Lanternwake registry.
