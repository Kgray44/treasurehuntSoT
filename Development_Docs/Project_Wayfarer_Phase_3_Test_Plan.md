# Phase 3 Test Plan

Implemented focused coverage lives in `src/wayfarer/chronicle-history.test.ts`,
`src/app/api/passport/history/route.test.ts`, and
`src/components/wayfarer/ChronicleHistory.test.tsx`. It proves personal timing,
canonical safe summaries, unavailable choice detail, consent-filtered Keepsake
crew output, automatic route projection, owner-only route inputs, empty and
failure component states, and absence of a manual reconciliation control.

The full suite is a separate gate. A live authenticated synthetic-Voyage browser
matrix and isolated live MySQL rehearsal remain required acceptance evidence;
neither is inferred from unit, component, or unauthenticated browser smoke.

2026-07-25 closure: `tests/e2e/wayfarer-phase3.spec.ts` now executes an
authenticated owner/crew/foreign-account matrix against a fresh 27-migration
SQLite database. It covers automatic projection, one-record idempotency,
late-join timing, pinned historical snapshots, safe detail DTOs, reflection,
soft-deleted Memory, Keepsake generation, consent grant/revocation, invitation
history, foreign-account denial, Axe serious/critical results, responsive
viewports, and One Voyage source-row invariance.
