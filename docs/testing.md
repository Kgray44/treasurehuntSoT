# Testing

Run the complete release gate with:

```powershell
npm run validate
```

## Complete validation gate

The command creates a clean local runtime and disposable database, then runs Prisma generation/migration/seed, database invariants, Prettier, ESLint, TypeScript, the complete Vitest suite, the Chromium/WebKit browser matrix, post-acceptance database checks, production build, and two production restart proofs.

The live workflow covers player/GM access, rate limiting, cookie isolation, prepare without disclosure, SSE release, ceremony timing/replay/preferences, persistence, duplicate rejection, award/map/solve/undo, offline pause/resume reconciliation, and heartbeat. Command Center tests add preview nonmutation, stale conflict, idempotent replay, all authenticated workspaces, mobile emergency layout, axe accessibility, and visual captures across desktop/tablet/mobile.

Artifacts are ignored and written below the validation runtime at `artifacts/validation`; Command Center screenshots are in `artifacts/validation/command-center`. `PLAYWRIGHT_BASE_URL` and `FOREVER_VALIDATION_PRODUCTION_PORT` may select isolated ports for parallel sessions.

Both variables are validation-only isolation controls. Their defaults are port 3000; no launch command silently falls back when 3000 is occupied. The full gate may select an explicit temporary port while another verified task owns 3000, but that port is never documented or persisted as a second product runtime.

## Integrated validation workflow

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

Product-polish unit coverage verifies public catalog search/progress filtering, no-results reset, connection-failure recovery, shell current-route semantics, skip navigation, mobile-menu focus entry and Escape restoration, and deliberate shell removal on the canonical journal. Manual browser review covers the landing explanation and mobile control placement; public search/no-results behavior; Player empty-library and sign-in states; Captain desktop/mobile grids, tabs, wizard selection/progress, and focus restoration; Studio density; invitation recovery; route metadata; immersive journal entry; console output; and document-width checks at the six required viewports.

Tall Tale Studio unit coverage asserts the complete 23-type block registry, schema metadata, required-field validation, provider dispatch, safe unknown-block behavior, normalization, conditions, variable mutation, route rate limits, slug rules, optimistic autosave tokens, and the helper verification envelope. Browser coverage proves the version-pinned player/Captain/helper path, helper heartbeat and revocation, completed catalog state, dnd-kit authoring affordance, responsive inspector dismissal, isolated block preview, published-version preview, copy-to-new-draft, and a media-rich create/upload/author/align/publish/play/artifact/history golden path. Database verification additionally proves that the additive seed has a current immutable version, two chapters, and a terminal block while retaining legacy campaign data. For a manual golden path: edit and preview the seeded tale, publish, start it from `/tales`, solve `lantern`, approve it from `/captain`, and complete the remaining blocks.

Tall Tale Platform unit coverage adds lifecycle transition rules, role/resource authorization, and audit redaction. Its Chromium journey forks and publishes a Tale, atomically creates and accepts a secure invitation, denies cross-role access and missing Player CSRF, launches the crew, publishes a newer edition, proves the active playthrough remains pinned, completes it, validates the exact-version archive, persists pin/hide preferences, retries acceptance idempotently, and verifies replacement/revocation. A read-only mobile WebKit pass covers the reduced-motion gateway, responsive width, accessibility, and protected API denials. Validation also creates a legacy-shaped playthrough, runs the normal progress-preserving seed, and proves that ID, version, events, timestamps, membership, and reveal history survive backfill.

Canonical journal unit coverage asserts the typed presentation schema, recursive Player secret removal, mode mapping, stable page IDs/parity, two-page spreads, chapter/current-objective indexes, StPageFlip revision refresh, queued turn locking, and distinct left/right geometry. The platform Chromium journey now enters the physical journal after launch, verifies canonical Player-safe state, proves reading-state persistence does not mutate the current story block, follows the same journal into completed historical mode, and checks that the immutable edition/checksum remain visible while actions are disabled.

Unified Experience coverage adds stable route parsing, invalid-section fallback, Map/Artifacts/Messages full-page rendering, persisted section state, tab ARIA semantics, keyed route-transition signals, breadcrumb hierarchy, semantic theme parsing/fallback, and direct Chapters/Map navigation in the platform Chromium journey. Manual review covers forward/back replay, both application themes, explicit Tale override, focus transfer, compact connection status, 375/430/768/1024/1440/1920 widths, and absence of horizontal overflow or content-obscuring overlays.

The 2026-07-17 platform release gate passed 25 Vitest files with 80 tests and 21 Playwright tests with 7 intentionally skipped mobile mutation permutations. Post-browser verification passed before and after the progress-preserving seed, and the production build plus both restart-safety cycles completed successfully.

The 2026-07-18 product-polish release gate passed 31 Vitest files with 99 tests and the same 21-test Playwright acceptance matrix with 7 intentional mobile mutation skips. Formatting, ESLint, strict TypeScript, animation assets, migration/seed/backfill invariants, accepted-state verification, the progress-preserving seed rerun, the optimized production build, and both restart-safety cycles also passed.
