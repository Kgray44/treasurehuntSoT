# Project Harborlight Phase 3 - Design Record

## Baseline and inventory

- Repository: `treasurehuntSoT`; canonical network checkout is preserved.
- Phase 3 worktree: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-harborlight-phase3-welcome-the-fleet`.
- Branch/base: `codex/project-harborlight-phase3-welcome-the-fleet` from fetched `origin/main` `6bd8209d2d7f0edc73da9566fd06e825ae51a602`.
- Existing Harborlight authority is `CommunityProfile`, `CommunityListing`, immutable `CommunityRelease`, package/install/lineage records, the `src/community` service facade, public listing route `/api/community/listings/public/[slug]`, and process-local shared rate limiting. Phase 2 package/publication/install behavior is retained.
- Canonical identity is `UserAccount` with `PlayerProfile`; canonical completion is `TaleSession.status === COMPLETED` with its immutable `PublishedTaleVersion`. Sealed Hold owns scan/storage/provider implementations and Lanternwake owns scene registration and runtime behavior.

## Frozen boundaries

Harborlight reads canonical completion and Wayfarer public identity projections; it neither mutates sessions nor copies Chronicle prose, event payloads, answers, variables, invitations, Captain notes, account secrets, or raw media. Public, search, sharing, and Open Graph responses use explicit server projections. A value absent from a public projection cannot be recovered by client rendering, facets, cursors, logs, or error responses.

The Phase 3 schema is additive and uses the reserved SQLite migrations `20260725140000` through `20260725145000_harborlight_phase3_review_snapshots` and MySQL migrations `0031` through `0036_harborlight_phase3_review_snapshots`. Harborlight owns the extended identifiers: on 2026-07-25, direct remote-tree inspection of active Wayfarer Phase 3 (`1403e64e`), Sealed Hold Phase 3 (`9f158e74`), and Lanternwake integration (`b168ecba`) found neither path. No down migration, `db push`, reset, truncation, or mutable release update is allowed.

## Frozen model and service contracts

`CommunityListingDiscoveryMetadata` supplies typed indexed discovery fields. `CommunitySearchDocument` is the only discovery source and contains normalized safe title/summary/categories/tags/creator names plus sanctioned filter values; `CommunitySearchToken` carries bounded query tokens. `CommunityListingAggregate` and `CommunityTrendBucket` are derived, reconcilable counters.

Identity-attached records are `CommunityCreatorFollow`, `CommunityBlock`, `CommunitySave`, `CommunityCollection`, `CommunityCollectionItem`, `CommunityProfileFeaturedItem`, `CommunityBadgeDefinition`, and `CommunityProfileBadgeGrant`. A block denies follows, saves, voting, comments, collection visibility, and public interaction in either direction. Idempotency keys are unique per actor/action/resource.

Interaction records are `CommunityReview`, `CommunityReviewDimension`, `CommunityReviewHelpfulVote`, `CommunityCreatorResponse`, `CommunityComment`, and `CommunityReport`. Review spoiler text is a separate server-only field; public projections contain spoiler-free text only. Verified installation derives from `CommunityInstallation`; verified completion derives only from a completed canonical `TaleSession` associated privately with a Voyage Log.

Completion sharing records are `CommunityVoyageKeepsake`, `CommunityVoyageLog`, participant/media consent records, media records, and sharing restrictions. Keepsakes are private by default and idempotently derived from a completed session without changing it. Public media is a separately checksummed sanitized derivative; public EXIF GPS is stripped, private locations are omitted, and approximate locations are generalized.

Guides are persisted `CommunityGuideContent`; recommendations are rules-based and return an explicit reason. No machine-learning claim is made.

## Discovery contract

Queries are Unicode-normalized, case-folded, whitespace-collapsed, length-bounded, tokenized, and rejected for control characters. Cursor payloads are opaque base64url JSON containing version, selected sort tuple, and listing ID; all sorts append the stable listing ID. Supported filters are type, themes/categories, duration, player count, environment, age, difficulty, travel, props, helper/Vision Waypoint, representation, languages, accessibility, free/remix state, compatibility, creator, rating, and update window. Only published, active, Community/Featured records are indexed; unlisted, crew-only, private, quarantined, removed, and hidden-spoiler records are absent before filtering and aggregation.

Sorts are featured, newest, recently updated, bounded trending, installs, rating, completions, and saves. Trending uses a capped recent 14-day event window with unique actors, logarithmic action weights, and time decay; it is not a lifetime-view counter. Aggregate changes use an outbox event and reconciliation service.

## Authorization, presentation, and safety

Public readers receive only public listing/profile/Voyage Log/Guide projections. Owners may manage their records; creator response requires listing ownership; review verification is server-derived; report creation is authenticated and rate-limited; no public moderator console is added. All state-changing actions require canonical actor, CSRF route conventions, centralized rate-limit category, and idempotency key.

Community pages include landing, category/search, listing, creator, collection, guide/workshop, and Voyage Log surfaces with loading/error/empty/retry states. Scene triggers occur only after the authoritative operation succeeds; reduced motion resolves to an announced semantic state. Phase 3 does not claim production scanner, object storage, durable workers, distributed rate limiting, production MySQL, monitoring, or incident operations.
