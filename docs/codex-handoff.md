# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`, branch `main`
- Phase: production foundation + fully automated, acceptance-tested local demo
- Last milestone: one-command startup/shutdown, clean validation database, full GM/player browser workflow, cross-browser accessibility, reconnect recovery, screenshots, build and restart proof
- Architecture: Next App Router, Prisma SQLite/MySQL, database sessions, ordered events/SSE, central ceremony queue
- Story model: seven states and 18 event types implemented; development Chapter One only
- Database: normalized schema, tracked SQLite schema/migration, clean validation rebuild and invariant verifier passing; MySQL schema prepared, not deployed
- Authentication: player code cookie and GM bcrypt/database session/CSRF/rate limit implemented
- Tests: 6 Vitest tests; 5 Chromium/WebKit browser checks passing with 1 intentional cross-project skip; axe scans, database invariants, production build, and two-cycle restart proof passing
- Known failures: none; Playwright may log a harmless screenshot-caret hydration warning only when an older runner uses its default hidden-caret capture
- Technical debt: Redis fan-out, dedicated GM preview, connector-parity migration generation, CI workflow
- Development-only content: The First Seal, Broken Compass Needle, Port Merrick, Echoes of the Past
- Do not casually rewrite: `src/server/progression.ts`, public snapshot filtering, ceremony queue, dual Prisma schemas
- Recommended next task: add CI for `npm run validate` and production-like MySQL integration coverage
- Latest validated implementation commit SHA: `68a92f25bf511e5eb4176f802d38dbc0897ff825` (fresh GitHub clone, install, migration/seed, launch/health/stop, full validation, build, and restart proof)
- Updated: 2026-07-16
