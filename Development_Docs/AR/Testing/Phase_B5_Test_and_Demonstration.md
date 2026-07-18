# Phase B-5 Test and Demonstration Record

## Automated scope

The validation command is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-all.ps1 -SkipBrowserInstall
```

It checks formatting, lint, TypeScript, Vitest, desktop bridge tests, all Companion tests, database/migration/backfill fixtures, browser acceptance, accepted-state persistence across reseed, production build, and two production starts.

Final continuous run on 2026-07-18: **exit 0 in 332.2 seconds**. All 10 SQLite migrations applied from an empty database; formatting, lint, and typecheck passed; 37 Vitest files / 115 tests passed; 3 desktop tests passed; 29 Companion tests passed; and Playwright reported 33 passed with 13 intentional shared-database mutation/WebKit skips and 0 failed. Accepted-state verification before and after `seed --ensure`, the Next.js production build, and production restart safety all passed. Validation artifacts are generated outside the repository at `%LOCALAPPDATA%\ForeverTreasureCompanion\validation\artifacts\validation`.

The B-5 browser suite runs shared-database mutations in Chromium. It creates a separately published Captain-confirmed story fixture, runs the production B-4 engine against an independently consumed synthetic pilot frame sequence, installs/uses the exact package authorized by the server, and verifies:

- `VERIFIED` waits for Captain and advances exactly once after approval;
- package substitution is rejected before duplicate-result handling;
- automatic promotion is rejected while field evidence is missing;
- explicit Vision success/Captain/presentation events are recorded;
- hard-negative and insufficient results do not advance;
- delayed results after a Captain stage jump become stale;
- offline reconciliation is idempotent;
- Player readiness and local-frame privacy text are visible.

The Companion integration test exercises the real command contract, package install/cache integrity, B-4 runtime service, positive multi-frame verification, and raw-frame non-retention. Unit/contract tests cover stage-token binding/expiry, diagnostic sanitization, guidance, safe mode demotion, attempt transitions, and feature flags.

## Evidence boundary

The automated B-5 fixture uses the production B-4 engine and package format, but its image sequences are the disclosed synthetic mathematical fixtures with `seaOfThievesClaim=false`. It proves the integration path, not the required real Sea of Thieves pilot demonstration or field reliability.

## Manual scenarios A through F

Status: **NOT RUN / INCOMPLETE**. Authorized real pilot recordings, a live selected game window, and target-hardware measurement session were unavailable. Therefore none of the prompt's scenarios A-F is marked passed. In particular, synthetic automation is not reported as the required manual demo.

When prerequisites exist, run A-F exactly from the governing prompt: Captain-confirmed success/reload, strongest known hard negative, insufficient then corrected retry, shadow approval exactly once, offline cache/reconnect exactly once, and one technical failure/recovery without story-state loss. Capture timestamps, package/waypoint/version IDs, attempt/event IDs, screenshots, logs, truth labels, and before/after story sequences.

## Performance and accessibility

B-4 synthetic warm CPU measurements remain useful engineering evidence but are not B-5 target-hardware/game-impact evidence. No new live CPU/GPU/VRAM/thermal/game-contention measurement is claimed. Automated semantic controls, keyboard hold/toggle/cancel paths, live-region progress, readable truthful messages, and reduced-motion reuse are regression-covered; a human assistive-technology review was not run.

## Release interpretation

Passing automation establishes implementation correctness for the covered synthetic/local path. It cannot close the Phase B-4 prerequisite, manual scenarios A-F, target-hardware desktop E2E, performance, human accessibility, or game-impact gates. The Phase B-5 recommendation therefore remains NO-GO.
