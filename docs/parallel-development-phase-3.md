# Phase 3 parallel-development record

- Base and starting commit: `70bb654b78a84df15dba8d0f9ce5b3fd5782181d`
- Branch: `feature/game-master-command-center`
- Base branch: `origin/main`
- Worktree: isolated from the dirty Phase 2 checkout

## Shared contract review

Existing behavior uses `src/domain/story.ts` for seven chapter states and ordered player events, `src/lib/snapshot.ts` for the player-safe projection, and `src/server/progression.ts` as the Phase 1 transaction boundary. Phase 3 needs administrative commands, staging, preview, idempotency, presence, and audit correlation. Phase 2 is likely to touch `story.ts`, both Prisma schemas, seed data, the player component, and the snapshot.

Compatibility strategy: administrative schemas live in `src/domain/admin.ts`; new tables and audit fields are additive; existing fields and endpoints remain; presence is additive to legacy `lastSeenAt`; the public snapshot shape is unchanged; player event additions use optional version-1 payloads. Preview clones the sanitized snapshot and never writes.

Shared files modified: `src/domain/story.ts`, `src/server/progression.ts`, `src/components/player/PlayerExperience.tsx`, both Prisma schemas, `prisma/seed.ts`, and appended Command Center CSS. New events are `HINT_PREPARED`, `MAP_REVEAL_PREPARED`, `ARTIFACT_AWARD_PREPARED`, `SIDE_QUEST_UPDATE_PREPARED`, `PLAYER_RECONCILIATION_REQUESTED`, and `NARRATIVE_MESSAGE_RELEASED`.

New APIs: `POST /api/gm/commands`, `POST /api/gm/preview`, `POST /api/gm/staging`, and `POST /api/player/[campaignSlug]/presence`. Admin routes require a GM session; writes also require CSRF. Commands validate expected sequence and idempotency key.

Likely conflicts are Phase 2 snapshot/event additions, schema relations on `Campaign` and `PlayerAccess`, seed fixtures, and player lifecycle effects. Recommended integration: retain Phase 2 player visibility first, then reapply Phase 3 administrative models/events and adapt heartbeat reporting. Post-merge validation must regenerate both clients, migrate clean SQLite, and run unit, E2E, accessibility, build, two-context SSE, preview-nonmutation, stale-command, and leakage checks.
