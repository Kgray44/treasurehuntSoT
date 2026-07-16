# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`, branch `main`
- Phase: production foundation + first theatrical vertical slice
- Last milestone: responsive sealed journal, authenticated GM progression, SSE ceremony, map reveal, undo, tests, and deployment docs
- Architecture: Next App Router, Prisma SQLite/MySQL, database sessions, ordered events/SSE, central ceremony queue
- Story model: seven states and 18 event types implemented; development Chapter One only
- Database: normalized schema, SQLite migration and idempotent seed validated; MySQL schema prepared, not deployed
- Authentication: player code cookie and GM bcrypt/database session/CSRF/rate limit implemented
- Tests: 6 Vitest tests and 2 Chromium Playwright smoke tests passing
- Known failures: none in build/unit/Chromium smoke; WebKit not run
- Technical debt: fuller transactional integration tests, Redis fan-out, dedicated GM preview
- Development-only content: The First Seal, Broken Compass Needle, Port Merrick, Echoes of the Past
- Do not casually rewrite: `src/server/progression.ts`, public snapshot filtering, ceremony queue, dual Prisma schemas
- Recommended next task: add isolated database fixtures and complete the full GM-release/undo Playwright scenario
- Latest validated commit SHA: updated in the task report after commit
- Updated: 2026-07-16
