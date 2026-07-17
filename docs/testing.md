# Testing

Run the complete release gate with:

```powershell
npm run validate
```

The command mirrors network-share checkouts into a clean local runtime, rebuilds disposable `validation.db`, and runs:

1. Exact lockfile install, Prisma generation, migration deployment, seed, and baseline database invariants.
2. Prettier, ESLint, strict TypeScript, Vitest component/unit tests, and local animation-asset validation.
3. Seed verification, pinned Chromium/WebKit installation, and Playwright acceptance/accessibility workflows.
4. Post-acceptance event/snapshot/audit and undo-state verification.
5. Optimized Next.js production build.
6. Two consecutive production start/health/stop cycles, including proof that `/dev/animations` returns 404.

Animation coverage includes director queue/synchronization/skip/failure/cancellation/cleanup, every scene builder in all modes, semantic labels, ownership, visibility observers, asset contracts, local Lottie lifecycle/controls/failure, local Rive inputs/lifecycle/WebGL fallback, StPageFlip initialization/update/destroy/keyboard/orientation/reduced behavior, journal secret filtering/stable pages, Motion variants/navigation/objective controls, modal focus restoration, first-arrival replay/skip, and the guarded showcase/trailer.

The browser workflow also covers access/GM failure and success, rate limiting, cookie isolation, live SSE chapter release, named scene checkpoints, replay without mutation, sound/motion preferences, refresh persistence, artifact/map progression, solve/undo, offline pause/resume reconciliation, heartbeat, deep links, responsive viewports, and axe serious/critical violations.

Required viewports are 2560 × 1440, 1920 × 1080, 1440 × 900, 430 × 932, 390 × 844, and 844 × 390. Stable screenshots are captured at semantic checkpoints rather than arbitrary delays. Reports, traces, screenshots, and production logs are ignored under `%LOCALAPPDATA%\ForeverTreasureCompanion\validation\artifacts\validation` for network-share checkouts.

Focused commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run assets:validate`, `npm run test:e2e`, and `npm run build`. Detailed animation test and manual leak/profile instructions are in `docs/animation/testing.md` and `docs/animation/performance.md`.
