# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`, branch `main`
- Phase completed: Phase 2 — complete Player Companion shell
- Repository visibility: **public** as verified 2026-07-16; only fictional development content is permitted
- Latest validated implementation commit: `0f510a3f218a464259f19efa4f6b8991a8546f4f`
- Updated: 2026-07-16

## Player surfaces

- Player: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Game Master: `http://127.0.0.1:3000/quartermaster`
- Sections: `journal`, `chart`, `treasures`, `quests`, `log`, `finale`
- Navigation: `?section=<id>` with pushState/popstate restoration, shared desktop/mobile state, and one SSE connection
- Persistent current objective, compact preferences, player-initiated fullscreen, artifact inspection, chapter index, accessible map list, and event-derived log are implemented

## Architecture

- Next.js App Router, Prisma SQLite/MySQL, database-backed sessions, ordered domain events/SSE, central ceremony queue
- Public snapshots are server allowlist projections; raw event payloads never reach the player stream
- New models: `MapRoute`, `ViewedContent`
- Extended models: campaign finale shell; chapter safe teasers/cross-links; artifact release/assembly state; map safe labels/reveal metadata; optional quest rewards/links; journal annotations; companion preferences
- New event families: route reveal, artifact silhouette/connection, quest completion, annotations/log entries, finale tease/requirements
- Ship's Log is derived by `src/domain/ships-log.ts`, not stored as duplicate display history
- Unseen state is cross-device per player access identity; ceremony playback remains device-local

## Development presets

Run `npm run db:preset -- <preset>` to reset the development campaign. Supported values:

- `awaiting-first-release` (default seed)
- `active-chapter`
- `mid-voyage`
- `artifact-award-ready`
- `side-quest-active`
- `nearly-complete-shell`
- `all-empty`
- `long-log`
- `mobile-stress-test`

Presets are CLI-only, safe to repeat, development-content-only, and not exposed to players or production UI.

## Commands

- Start everything: `npm run dev:full`
- Stop: `npm run dev:stop`
- Complete validation: `npm run validate`
- SQLite generate/migrate/seed: `npm run db:generate && npm run db:migrate && npm run db:seed`
- MySQL companion migration: apply `db:migrate:mysql:init` then `db:migrate:mysql:companion`

Local development defaults come from `.env.example`: player phrase `development-moonwake`; GM `kato` / `development-captain-only`. Never use them outside an isolated local development database.

## Validation state

- Strict TypeScript: passing
- Unit tests: 13 passing across 5 files
- ESLint: passing
- Production build: passing
- SQLite migrations: clean application of init + companion migration
- `mid-voyage` fixture integrity: 12 contiguous events, 12 snapshots, 12 audits
- In-app browser: all six sections, deep-link history, artifact dialog, sealed finale, 1440/1920 desktop and 390 mobile states inspected with zero horizontal overflow and no console warnings
- Chromium/WebKit automated acceptance and clean-clone validation are part of the final task gate; consult the ending task report for exact counts/artifacts

## Known limitations and next phase

- Real story, riddles, locations, photographs, personal memories, romantic messages, production tokens, and finale content remain blocked until the repository is private.
- Finale states beyond `REQUIREMENTS_PARTIAL` and real assembly are intentionally unavailable.
- SSE fan-out is process-local; add Redis/equivalent before multi-instance deployment.
- Initial log projection is capped at 250 entries; add cursor pagination for larger production histories.
- Exercise the parallel MySQL migration against MySQL 8 in CI.
- Recommended Phase 3: make the repository private, establish the Creative Bible/content pipeline, then author final story through versioned private content without changing the shell architecture.
