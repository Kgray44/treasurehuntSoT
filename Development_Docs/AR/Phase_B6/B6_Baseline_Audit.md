# Phase B-6 Baseline Audit

Audit date: 2026-07-18

Audit status: complete before Phase B-6 product implementation changes

## 1. Authority and truth boundary

This audit compares the repository at the Phase B-5 synchronized commit with `TT-VISION-GOV-001 v1.0`, `TT-VISION-PHASE-B-001 v1.0`, and the Phase B-6 implementation prompt. The source PDFs were text-extracted and visually spot-checked around the Phase B definition of done, B10 production-hardening work package, B-6 installer/updater/security work packages, and B-6 exit gate.

Passing software tests do not close missing field evidence. The repository has production-path software exercised with synthetic fixtures, but no three real Sea of Thieves pilot corpora, no external creator cohort, no clean-machine installer/update/rollback study, no signed application artifact, and no current target-hardware/game-impact study. Those gaps remain release blockers.

## 2. Repository state before implementation

| Field             | Observed baseline                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Repository root   | `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B6`                                                |
| Branch            | `codex/phase-b6-hardening-public-release`                                                             |
| Source/upstream   | `origin/codex/phase-b5-player-story-captain`                                                          |
| Commit            | `f26ef7d9c3d3d6fbe4b60cf2c5cabed445186001`                                                            |
| Upstream parity   | behind 0, ahead 0                                                                                     |
| Working tree      | only ignored local `.env` plus untracked audit-only `tmp/` PDF render material; no product changes    |
| Main checkout     | not modified; two user-owned untracked governing PDFs preserved there                                 |
| Package manager   | npm 11.9.0 with committed `package-lock.json`                                                         |
| Runtime           | Node.js 22+; validation used Node.js 24.18.0                                                          |
| Frontend/backend  | Next.js 16 App Router, React 19, server routes in the same application                                |
| Desktop/Companion | Electron 41 desktop shell and Electron/native window-capture Companion                                |
| Database          | Prisma 6.19; SQLite runtime schema and additive migrations; MySQL production schema/migration scripts |
| Vision runtime    | local classical CPU feature, matching, geometry, pose, and temporal engine; no active GPU provider    |
| Installer         | electron-builder 26.15.3, NSIS assisted per-user target                                               |
| CI/CD             | no `.github` workflow or other repository CI configuration found                                      |
| Release scripts   | `desktop:stage`, `desktop:build`, `desktop:smoke`, `validate`, and Phase B verification scripts       |
| Documentation     | `Development_Docs/AR`, product `docs/`, and ADRs under `Development_Docs/AR/ADRs`                     |

Relevant subprojects are the shared Next application in `src/`, the Electron desktop shell in `apps/desktop`, the Companion and vision engine in `apps/companion`, Prisma schemas/migrations in `prisma/`, acceptance tests in `tests/e2e`, and release/development tools in `scripts/`.

## 3. Phase B capability classification

Classification means:

- **Complete**: implemented and covered by current automated evidence.
- **Complete but untested**: implementation exists without required current evidence.
- **Partially complete**: useful implementation exists but a required behavior or evidence class is missing.
- **Mocked**: only a mock path exists.
- **Absent**: no implementation found.
- **Broken**: present baseline path failed its available test.
- **Incompatible**: contradicts the current shared architecture.

### 3.1 Phase B-1

| Capability                           | Classification     | Baseline evidence or gap                                                              |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------- |
| Shared frontend/package architecture | Complete           | Shared Next routes/components and immutable package contracts pass unit/E2E coverage. |
| Platform adapter interfaces          | Complete           | Web and desktop adapters and parity tests pass.                                       |
| Web and PWA shells                   | Complete           | Installable shell and network-owned sensitive truth tests pass.                       |
| Desktop shell                        | Partially complete | Source bridge tests pass; packaged smoke is broken at baseline.                       |
| Waypoint domain models and lifecycle | Complete           | Prisma/domain tests and B-1 acceptance path pass.                                     |
| Immutable versioning                 | Complete           | Published mutation rejection is covered.                                              |
| Companion protocol schemas           | Complete           | Versioned strict protocol/command validation passes.                                  |
| Typed feature flags                  | Complete           | Runtime/build/integration gates are explicit and default-safe.                        |

### 3.2 Phase B-2

| Capability                        | Classification                    | Baseline evidence or gap                                                                                                                    |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Native application-window capture | Partially complete                | Real Electron synthetic-window smoke exits 0; live Sea of Thieves/display matrix remains untested and packaged smoke fails.                 |
| Creator recording                 | Partially complete                | Managed WebM lifecycle is tested; live game workflow remains untested.                                                                      |
| Player scan                       | Partially complete                | Real synthetic-window and contract tests pass; live game conditions remain untested.                                                        |
| Bounded ring buffer and cleanup   | Complete                          | Eviction and zeroization tests pass.                                                                                                        |
| Hotkey                            | Partially complete                | Monitor/service tests exist; required physical hotkey ceremony is unperformed.                                                              |
| Quality analysis                  | Complete                          | Black/frozen/selection behavior is deterministic and tested.                                                                                |
| Browser pairing                   | Complete                          | Exact-origin, signed challenge, expiry/revocation, and replay defenses pass.                                                                |
| Local security                    | Complete for implemented boundary | Loopback is allowlisted and authenticated; broader B-6 independent review remains required.                                                 |
| Privacy behavior                  | Complete for implemented boundary | Player frames are memory-only and cleared; diagnostic frames require explicit consent. Independent B-6 privacy validation remains required. |

### 3.3 Phase B-3

| Capability                       | Classification     | Baseline evidence or gap                                                           |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Vision Waypoint Library          | Complete           | Search/filter/usage/version workflows have browser coverage.                       |
| Creation wizard                  | Partially complete | Twelve-step resumable UI exists; required three-profile usability study is absent. |
| Accepted-region workflow         | Complete           | Persisted geometry/rules and mutation coverage pass.                               |
| Hard-negative recording          | Partially complete | Workflow and gates exist; no real game corpus was captured.                        |
| Stable-region editor             | Complete           | Pointer and non-pointer editing plus accessibility checks exist.                   |
| Resumable drafts                 | Complete           | Disconnect/resume and optimistic concurrency pass.                                 |
| Deterministic BuildInput package | Complete           | Schema/hash/persistence tests pass.                                                |

### 3.4 Phase B-4

| Capability                     | Classification     | Baseline evidence or gap                                                                                                                       |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame curation                 | Partially complete | Production path passes synthetic fixtures; real capture diversity is absent.                                                                   |
| Global retrieval               | Partially complete | Production CPU implementation exists; real pilot reliability is absent.                                                                        |
| Hard-negative separation       | Partially complete | Synthetic negatives never verify; locked real negative corpora are absent.                                                                     |
| Local matching and geometry    | Partially complete | Deterministic synthetic gates pass; real-location evaluation is absent.                                                                        |
| Reconstruction and camera pose | Partially complete | Planar synthetic implementation exists; no real field accuracy study.                                                                          |
| Temporal consistency           | Partially complete | Multi-frame gate is implemented and synthetic-tested.                                                                                          |
| Calibration                    | Partially complete | Profile thresholds are calibrated on synthetic fixtures only.                                                                                  |
| Runtime packages               | Partially complete | Immutable/hash-checked local packages exist; public trust/signing/compatibility policy is absent.                                              |
| Replay harness                 | Partially complete | Three hard-coded synthetic fixture replays exist; no manifest-governed locked real corpus, comparison mode, CI tiering, or release statistics. |
| Hardware providers             | Partially complete | CPU provider is active; CUDA/DirectML are detected inventory only.                                                                             |

### 3.5 Phase B-5

| Capability                           | Classification               | Baseline evidence or gap                                                                     |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------- |
| Player hold-to-scan flow             | Partially complete           | Shared Player path and real B-4 synthetic fixture pass; live game/manual scenario is absent. |
| Story-event integration              | Complete                     | Authoritative progression transaction and stale/duplicate defenses pass.                     |
| Phase A presentation trigger         | Complete                     | Accepted attempts reveal through existing presentation ownership.                            |
| Captain diagnostics and override     | Complete for software path   | Review/override/audit flow passes; human field ceremony remains absent.                      |
| Shadow mode                          | Complete for software path   | Results persist without progression; no real pilot field use.                                |
| Automatic mode                       | Complete safe rejection      | Policy rejects/demotes automatic eligibility because release evidence is missing.            |
| Offline behavior and synchronization | Complete for derived results | Signed tokens, expiry, stale/duplicate reconciliation, and cached package behavior pass.     |
| Idempotency                          | Complete                     | Attempt/result/progression replay protection is covered.                                     |

No previous capability was found to require a separate rewrite or to be incompatible with the shared architecture. No B-1 through B-5 production capability is classified as merely mocked; where evidence is synthetic, the production code path is identified as partially complete rather than promoted to field-complete.

## 4. Baseline tests

### 4.1 Master validation

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-all.ps1 -SkipBrowserInstall
```

Result: **PASS**, exit 0, 350.9 seconds.

- 10 SQLite migrations deployed from an empty disposable validation database.
- formatting, lint, and TypeScript checks passed.
- 37 Vitest files / 115 tests passed.
- 3 restricted desktop bridge tests passed.
- 29 Companion/native/runtime tests passed.
- animation assets, seed data, B-1/B-2/B-3 fixtures, and legacy platform backfill passed.
- B-5 production-engine integration fixture declared itself synthetic and passed.
- Playwright: 33 passed, 13 intentional shared-database WebKit mutation skips, 0 failures.
- accepted state survived `seed --ensure`.
- optimized Next production build passed.
- production backend started twice successfully; development-only showcase returned 404 as required.

Non-gating warning: browser tests attempted to download Rive WASM from unpkg/jsDelivr and fell back after network failure. Offline animation fallback kept the tests passing, but external runtime fetches are a B-6 reproducibility/privacy/dependency issue.

### 4.2 Native Companion launch and capture

Command, run against the isolated validation mirror:

```powershell
node_modules\electron\dist\electron.exe apps\companion\electron-capture-smoke.cjs
```

Result: **PASS**, exit 0, 7 seconds. This exercises the real Electron application-window capture adapter against a controlled synthetic window, Player scan cleanup, Creator recording, repeated scans, target loss/recovery, and browser pairing. It is not Sea of Thieves field evidence.

### 4.3 Waypoint build, Player, Captain, and offline tests

Result: **PASS in automated synthetic coverage** as part of the master validation. The Companion production build/runtime tests and the B-5 Chromium acceptance test cover local build/package installation, Player verification, wrong/weak scenes, story progression, Captain action, stale/duplicate protection, and offline reconciliation. These do not replace the missing human/live scenarios.

### 4.4 Baseline installer build and signatures

The existing production Next build was staged and electron-builder created:

- `The Forever Treasure Companion Setup 0.7.0-b5.exe`, 243,335,377 bytes, SHA-256 `35999756B87F41C79A0EBE6A8C588BF39EDFC371CC5C164339F6E16ECD74F401`;
- unpacked desktop executable SHA-256 `B7872A61EBF0D587FCCCBA9344CB390126058E5D20210379ED067152ABD091E2`.

Result: **package build PASS; public-release gate FAIL**. PowerShell `Get-AuthenticodeSignature` reported `NotSigned` for both artifacts. The baseline configuration explicitly sets `signAndEditExecutable: false`, uses the default Electron icon, and has no proven signed update metadata or rollback process.

### 4.5 Packaged desktop smoke

Command:

```powershell
node scripts\desktop-smoke.mjs
```

Result: **FAIL**, exit 1 after the child application exited 0. The packaged app started the bundled Next server, but its synthetic capture target was absent from enumeration. The error was `DESKTOP_SMOKE_TARGET_MISSING`; Windows Graphics Capture repeatedly reported `-2147024809`. No structured successful smoke result was written. This failure existed before B-6 modifications and is release-blocking until corrected or explicitly shown to be a test-harness defect with a valid packaged capture replacement.

### 4.6 Tests unavailable at baseline

- clean-machine install, interrupted install, upgrade, uninstall-preserve-data, and complete uninstall;
- signed-artifact trust/SmartScreen behavior;
- signed update metadata, checksum rejection, atomic activation, failed-update rollback, and deferred update;
- multiple Windows versions/displays/DPI/graphics hardware;
- real Sea of Thieves native capture and waypoint builds;
- current CPU/GPU/game frame-time impact and thermal/long-session study;
- three independent real pilot corpora and locked negative results;
- external creator cohort and uninvolved Player/Captain usability;
- independent privacy/security review.

Unavailable evidence is recorded as unavailable, not passed.

## 5. Initial release blockers

The formal machine-readable register will be the release authority. Initial blockers discovered before implementation are:

1. packaged desktop capture smoke failure;
2. unsigned installer and application binaries;
3. absent signed update/atomic activation/rollback implementation and tests;
4. no CI configuration for fast or release-corpus gates;
5. no governed independent reliability corpus or real pilot evidence;
6. no B-6 hardware/display/performance/long-run evidence;
7. no clean-machine installer/update/uninstall evidence;
8. no external creator/Player/Captain cohort evidence;
9. no independent B-6 security/privacy validation;
10. external Rive WASM fetch attempts in an otherwise local/offline product path.

Until all release-blocking issues are closed with evidence, the product cannot be labeled Creator Preview or Stable.
