# Phase B-1 Demonstration

## Reproduce the governed slice

1. Install and prepare a disposable development database:

   ```powershell
   npm ci
   npm run db:generate
   npm run db:migrate
   npx tsx prisma/seed.ts --ensure
   ```

2. Start the shared browser application with `npm run dev:full`, sign in as development GM `kato`, and open `/studio/vision-waypoints`.
3. Create an `EXACT_LANDMARK` waypoint with `STORY_CRITICAL` verification. Publish version 1 with the `verified` deterministic scenario.
4. Confirm version 1 has a SHA-256 package hash and cannot be edited. Derive version 2, change its hold duration, and confirm version 1 is unchanged.
5. Open the seeded `B-1 Vision Waypoint Demonstration` in Studio and confirm `Inspect the Painted Lantern` binds the exact published version ID.
6. Start `b1-vision-waypoint-demo`, open the Player URL, open/skip the canonical journal ceremony, and confirm the scan card says it is a deterministic mock with no camera or game access.
7. Hold `Hold to Inspect Surroundings`. Confirm the verified result crosses the existing `submitVerification` seam, the current-objective tray changes once, and `Return to Current Objective` opens the newly released `The mark is true` leaf.
8. Repeat with `duplicate_result_delivery`; confirm one `verificationSatisfied` event and a persisted `Duplicate rejected` diagnostic.
9. Exercise `insufficient`, `not_at_target`, `ambiguous`, `system_error`, and `cancelled`; confirm none advances the story.
10. Exercise `stale_stage` and `delayed_verified` while moving the session to a different stage; confirm the result persists as rejected stale and does not advance the current stage.
11. Open the Captain session. Confirm persisted attempt state, result, delivery, runtime/adapter, protocol/package version, duplicate/stale indicators, and transition history are visible and copyable.
12. Run `npm run desktop:test`, `npm run desktop:build`, and `npm run desktop:smoke`. Confirm the packaged Electron application loads the same loopback-served Next application and exposes only the three allowlisted preload commands.
13. Serve the production build, inspect `/manifest.webmanifest`, register `/sw.js`, and confirm the standalone PWA metadata. Take the app offline and confirm `/offline` explains that mutable story/auth/Studio/Captain/Vision truth is unavailable. Confirm `/api/` and sensitive workspace/live-session routes never enter Cache Storage.

## Automated evidence

The deterministic browser proof is `tests/e2e/vision-waypoint-b1.spec.ts`. It generates:

- `artifacts/validation/phase-b1/00-studio-waypoint-versioning.png`
- `artifacts/validation/phase-b1/01-player-vision-ready.png`
- `artifacts/validation/phase-b1/02-player-verified-advanced.png`
- `artifacts/validation/phase-b1/03-captain-attempt-diagnostics.png`

Run it alone with `npx playwright test tests/e2e/vision-waypoint-b1.spec.ts --project=chromium`, or run the clean-database cross-browser gate with `npm run validate -- -SkipBrowserInstall`. The latter is the release evidence source; screenshots and HTML reports are generated validation artifacts and are not committed.
