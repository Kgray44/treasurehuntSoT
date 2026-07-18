# Phase B-3 Test Plan and Results

Status: automated gate passed; human usability and live target-game demonstration remain blocked

Final automated gate: 2026-07-18

## Clean-runtime command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-all.ps1 -SkipBrowserInstall
```

The script mirrors the worktree without Git/node/build artifacts, creates a new SQLite database, applies all migrations, seeds deterministic data, and runs the complete gate.

## Final results

| Area                                  | Result                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Dependency audit                      | `npm ci`: 788 packages, 0 vulnerabilities                                             |
| Formatting                            | Pass, all matched files                                                               |
| ESLint                                | Pass                                                                                  |
| TypeScript                            | Pass                                                                                  |
| Unit/component/domain                 | 36 files, 111 passed                                                                  |
| Desktop restricted bridge             | 3 passed                                                                              |
| B-2 Companion contracts/runtime       | 20 passed                                                                             |
| Animation assets                      | 3 Lottie JSON, 1 Rive binary, SVG fallbacks valid                                     |
| Migrations                            | 8/8 applied on fresh SQLite                                                           |
| B-1 fixture                           | Pass; immutable package hash and exact binding preserved                              |
| B-2 persistence                       | Pass; idempotent manifest, interruption, audit, deletion, no verification decision    |
| B-3 migration                         | Pass; Guided/revision defaults, B-1 preserved, B-2 fields readable                    |
| Platform backfill                     | Pass; identity/membership/reveal/event history preserved                              |
| Playwright                            | 32 passed, 12 intentional shared-database WebKit mutation skips, 0 failed             |
| Accepted-state verification           | 16 legacy events, 18 legacy audit entries, 15 playthroughs, 75 platform audit entries |
| Seed-preservation rerun               | Pass; sequence 16 and accepted counts unchanged                                       |
| Production build                      | Pass; Next.js 16.2.10 optimized build, 37 static pages generated                      |
| Production restart                    | Pass twice on the same port                                                           |
| Desktop package                       | Pass; `0.5.0-b3` installer and unpacked executable produced and hashed                |
| Electron Companion smoke              | Pass; actual desktop-capturer adapter with synthetic harness window                   |
| Unsigned packaged launch              | **Blocked; local Application Control returned `spawn UNKNOWN`**                       |
| Human usability                       | **Blocked; 0 participants observed**                                                  |
| Live Sea of Thieves B-3 demonstration | **Blocked; no target-game window running**                                            |

## B-3 unit/domain coverage

`src/vision/authoring-domain.test.ts` proves:

- all seven initial waypoint types validate in Purpose;
- step state resumes deterministically;
- rectangle/polygon normalized geometry and coordinate bounds;
- Story-Critical nearby/distant hard-negative gates;
- locked-test gate;
- stable canonical serialization independent of object insertion order.

Existing feature-flag tests retain `vision_build_engine=false` by default. The full B-3 gate explicitly enables the development fixture and the B-1 diagnostics test asserts that configured value.

## B-3 API and end-to-end coverage

`tests/e2e/vision-waypoint-b3.spec.ts` runs five required flows in Chromium:

1. **Exact Landmark happy path**: Story-Critical authoring, strict persisted manifest fixtures, accepted/boundary pose regions, target visual region, nearby/distant negatives, positive/negative tests, locked test, all wizard steps, deterministic BuildInput retrieval, hash, and no-model/no-confidence assertions.
2. **Disconnect/resume/conflict**: persisted browser-paired disconnected state, route reload at the saved step, and stale-revision `409 AUTHORING_CONFLICT` with current revision.
3. **Published immutability**: post-publication authoring returns `409 PUBLISHED_VERSION_IMMUTABLE`.
4. **Story-Critical gate**: missing nearby/distant hard negatives appear in Data Health and block preparation.
5. **Desktop/web parity**: both contexts render the same shared 12-step component and server data.

The happy path also verifies server-side `CAPTURE_ARTIFACT_IN_USE`, reads the persisted BuildInput job, captures the populated region UI, and runs Axe WCAG 2A/2AA with zero violations.

## Migration coverage

The fresh gate applies:

1. initial schema;
2. Player Companion shell;
3. Game Master command center;
4. Tall Tale Studio phase 1;
5. shared platform;
6. Vision B-1;
7. capture B-2;
8. Studio authoring B-3.

`scripts/verify-authoring-foundation.ts` then reads a migrated B-1 waypoint through the B-3 aggregate, confirms defaults, confirms missing evidence is reported rather than fabricated, and reads B-2 asset fields. Both SQLite and MySQL Prisma schemas validate.

## Accessibility

- The shared wizard is semantic headings/forms/navigation with visible focus.
- Pointer tools have an always-visible JSON coordinate-list alternative.
- Status/error text uses live/status/alert roles.
- Responsive WebKit-mobile parity tests pass.
- The populated Step 8 screen has zero Axe violations under `wcag2a` and `wcag2aa`.
- No severe unresolved automated accessibility defect is known.

This does not replace assistive-technology observation with real participants; that remains part of the blocked usability study.

## Compatibility corrections discovered during validation

Two test-only corrections were made and rerun:

- B-1 diagnostics now assert the configured build-engine flag while default-off behavior remains covered by unit tests.
- The live-voyage ceremony test arms each next transient-stage wait before capturing the current screenshot, removing an existing race without weakening any stage or timing assertion.

The final complete gate passed after both corrections.

## Environmental warnings

The browser runner could not fetch remote Rive WASM from public CDNs. The app used its local fallbacks and all animation/accessibility tests passed. No B-3 authoring behavior depends on that external fetch.

Desktop packaging completed successfully for version `0.5.0-b3`. The generated installer was 243,232,738 bytes with SHA-256 `419ABF898C6E3B625737DE14F69BDDB1603584190B87322350FF736533F1CCCA`; the unpacked executable was 223,783,424 bytes with SHA-256 `52C0DEA98AD9E16966A6A2B71B1E5A670470B8291C85555878C002CFC9CD9F42`. Generated packaging output was removed after verification.

The Electron Companion smoke harness passed using the actual `ELECTRON_DESKTOP_CAPTURER` adapter, including synthetic window discovery, minimize/restore recovery, five scans, raw-frame clearing, creator-output hashing/deletion, paired browser scan, and target-close detection. Launching the unsigned packaged executable was blocked by this machine's Application Control policy (`spawn UNKNOWN`); this is an environment/signing boundary, not a successful packaged-launch test.
