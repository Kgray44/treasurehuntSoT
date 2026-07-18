# Phase B-5 Data Model and Migration

## Additive schema

Migration `20260718230000_vision_player_story_captain_b5` (SQLite) and MySQL migration `0009_vision_player_story_captain_b5` add the following without deleting B-1 through B-4 data:

- `VisionPublishedBinding`: immutable published story/block/waypoint/package/policy snapshot, unique per published story version and block.
- `VerificationAttempt` B-5 columns: exact publication and binding identity, package/token/story version/Companion identity, configured/effective modes, engine evidence, Captain/presentation/offline disposition, and progression timestamps.
- `VisionCaptainDecision`: permissioned, reasoned, idempotent decisions and truth labels.
- `VisionRuntimeControl`: per-published-binding effective-mode, pause, eligibility evaluation, and safe-demotion truth.
- `VisionPresentationRun`: one status per attempt/story-event key for existing Phase A presentation.
- `VisionPendingEvent`: durable server-side reconciliation status, payload identity, conflict reason, and sync time.
- `StoryWaypointBinding` policies: assignment, accessibility, guidance, and scan configuration.

Existing mutable authoring bindings remain the draft source. Publication copies them into `VisionPublishedBinding`; runtime reads the published copy and rejects a hash mismatch. A published row is never updated in place.

## Migration procedure

1. Stop application writes and back up the production database.
2. Confirm the deployed source understands both old defaulted rows and B-5 rows.
3. Apply all earlier migrations in order, then the B-5 migration. For MySQL use `npm run db:migrate:mysql:integration` only in the approved maintenance workflow.
4. Run the additive seed/backfill and database verification commands from `scripts/test-all.ps1`.
5. Publish a new story version to materialize immutable B-5 bindings; old publications are lazily snapshotted only when their existing configuration is valid.
6. Keep all B-5/live/automatic feature flags off, deploy, then enable only the approved Captain-confirmed or shadow pilot surface.
7. Inspect attempt, decision, control, pending-event, audit, outbox, and Phase A presentation records before widening rollout.

Fresh migration and a representative pre-B-5 upgrade fixture are automated validation requirements. The upgrade fixture preserves existing Tall Tale, block, binding, waypoint/version, and verification-attempt rows while confirming the new defaults.

## Rollback

Disable `FEATURE_LIVE_EXTERNAL_AR`, `FEATURE_VISION_PLAYER_STORY_INTEGRATION`, `FEATURE_VISION_CAPTAIN_INTEGRATION`, and `FEATURE_VISION_OFFLINE_RECONCILIATION`; keep both automatic progression flags false. Cancel active capture, stop Companion, and deploy the last compatible application build. Additive B-5 tables/columns should remain in place during application rollback so attempts, audits, and pending conflicts are not destroyed.

Do not down-migrate by dropping columns until evidence has been exported and an approved maintenance plan proves no B-5 row is needed. Never mark an existing package automatic during rollback. If a package is corrupt, quarantine its cache entry and rebuild from governed creator inputs; do not modify the published package or binding.
