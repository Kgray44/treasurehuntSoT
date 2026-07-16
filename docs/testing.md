# Testing

Run the complete gate with:

```powershell
npm run validate
```

The command creates a clean local runtime and disposable `validation.db`, then runs, in order:

1. Prisma generation, migration deployment, idempotent seed, and baseline database invariants.
2. Prettier check, ESLint, and strict TypeScript.
3. Six Vitest state-machine/ceremony tests.
4. Pinned Chromium and WebKit installation.
5. Five cross-browser access/security/accessibility checks and one complete Chromium GM/player mutation workflow.
6. Post-acceptance database verification for contiguous events, matching snapshots/audits, deduplication, persistence, and undo state.
7. Optimized Next.js production build.
8. Two consecutive production start/health/stop cycles on port 3200.

The mutation workflow covers invalid/correct player access, unauthenticated/wrong/correct/rate-limited GM access, cookie isolation, prepare-without-disclosure, live SSE release, 5–9 second ceremony timing, stage captures, skip/replay, mute and reduced motion, refresh persistence, duplicate rejection, artifact/map persistence, solve/undo, offline pause/resume reconciliation, heartbeat, accessibility scans, and 2560/1920/1440/430/390/landscape viewports.

Reports, traces, screenshots, and production logs are ignored and written to `%LOCALAPPDATA%\ForeverTreasureCompanion\validation\artifacts\validation` for network-share checkouts, or `artifacts/validation` for local checkouts. A successful run currently reports 6 unit tests, 5 browser tests passing, 1 intentionally skipped cross-browser duplicate of the mutation workflow, 7 persisted events/audits, a successful build, and a successful restart proof.
