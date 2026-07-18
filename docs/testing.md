# Testing

## Phase 2 coverage

Unit coverage includes event reconciliation, event-to-log transformation, malformed/unknown event fallback, and event payload allowlisting. Database verification checks the five-chapter, five-location, two-route, five-artifact, and four-quest development fixture structure plus contiguous event/snapshot/audit invariants. Presets are reset with `npm run db:preset -- <name>`; default `npm run db:seed` retains the sealed acceptance start.

Run the complete gate with:

```powershell
npm run validate
```

The command creates a clean local runtime and disposable database, then runs Prisma generation/migration/seed, database invariants, Prettier, ESLint, TypeScript, 9 unit tests, the Chromium/WebKit browser matrix, post-acceptance database checks, production build, and two production restart proofs.

The live workflow covers player/GM access, rate limiting, cookie isolation, prepare without disclosure, SSE release, ceremony timing/replay/preferences, persistence, duplicate rejection, award/map/solve/undo, offline pause/resume reconciliation, and heartbeat. Command Center tests add preview nonmutation, stale conflict, idempotent replay, all authenticated workspaces, mobile emergency layout, axe accessibility, and visual captures across desktop/tablet/mobile.

The validated Phase 3 run reports:

- Unit after Phase 2 reconciliation: 16 passed, 0 failed, 0 skipped.
- Browser: 9 passed, 0 failed, 1 intentional WebKit duplicate-workflow skip.
- Reconciled database: 10 contiguous events, 11 audit records, sequence 10.
- Build: passed; all Command Center and API routes compiled.
- Restart: two passes on the configured validation port.

Artifacts are ignored and written below the validation runtime at `artifacts/validation`; Command Center screenshots are in `artifacts/validation/command-center`. `PLAYWRIGHT_BASE_URL` and `FOREVER_VALIDATION_PRODUCTION_PORT` may select isolated ports for parallel sessions.
