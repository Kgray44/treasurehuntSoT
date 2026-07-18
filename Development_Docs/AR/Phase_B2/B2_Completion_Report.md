# Phase B-2 Native Companion and Capture Runtime Completion Report

Report date: 2026-07-18  
Implementation branch: `codex/phase-b2-native-capture`  
Base: `origin/codex/phase-b1-foundation` at `9c0d64557845145f3f61f25b48bcbe8d3f473a5b`  
Source implementation commit: `4721acbce8738dd5c1c1bf5b73158ea07799620c`  
Overall status: **IMPLEMENTATION COMPLETE; FOUR TARGET-HARDWARE MANUAL EXIT ITEMS BLOCKED**

The implementation and automated release program are complete. The phase must not be represented as having a fully closed exit gate until Sea of Thieves/display-mode testing and a physical hotkey release ceremony are performed. No Sea of Thieves process or discoverable Microsoft Store package was available on the audited host.

## Summary

Phase B-2 adds one Windows capture core shared by the integrated Electron renderer and an explicitly paired browser. It captures only a current user-selected application window; streams bounded downscaled analysis frames to a ring buffer; creates capture-only player evidence; records creator WebM artifacts with strict manifests; measures exposure, blur, information, duplicates, frozen streams, and motion; monitors the HWND; supports a scoped global hotkey; and exposes privacy, pairing, artifact, and diagnostic controls through `/vision-companion`.

Browser pairing is loopback-only and origin-bound. The browser generates an ECDSA P-256 key and retains its private key only in memory. Desktop approval, a six-digit two-minute code, a fresh signed WebSocket challenge, monotonic sequences, unique request IDs, expiry, revocation, payload/rate limits, and narrow command/file surfaces prevent ambient localhost access.

Creator manifests can be attached transactionally to an owned draft waypoint and audited. Player pixels never reach Prisma, disk, the Next server, protocol JSON, or a verification decision. Phase B-2 capture logic has only `EVIDENCE_CAPTURED`, `INSUFFICIENT_CAPTURE_EVIDENCE`, `CAPTURE_CANCELLED`, and `CAPTURE_ERROR`; it cannot return `VERIFIED` or `NOT_AT_TARGET`.

Intentionally deferred work includes B-3 authoring workflow, B-4 recognition/model workers, B-5 story progression, live AR, cloud training/upload, and B-6 signing/updater hardening.

## Repository state and deliverables

The work was performed in the isolated worktree `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B2`. The original `main` checkout and completed B-1 worktree were not modified. The final source scope contains 70 added or modified files (56 source/configuration/test files and 14 development documents), grouped as follows:

- 22 files under `apps/companion` for contract, core, target/worker, ring/quality, storage, pairing/loopback, coordinator, HWND/hotkey helper, and native tests;
- Electron main/preload/command and packaged-smoke changes under `apps/desktop` and `scripts/desktop-smoke.mjs`;
- shared TypeScript capture protocol, adapters, browser client, persistence service, UI, styles, APIs, feature flags, CSP, and service-worker safety changes;
- additive Prisma schemas and one SQLite plus one MySQL migration;
- application, desktop, Companion, security, persistence, and browser tests;
- three ADRs and nine Phase B-2 engineering/completion records, plus two historical B-1 boundary annotations.

Package version is `0.4.0-b2`. `ws@8.21.1` is the only added production dependency. Existing development dependencies were moved to `electron@41.10.2`, `electron-builder@26.15.3`, and `concurrently@9.2.4`. `npm audit` and `npm audit --omit=dev` both report 0 advisories across 911 dependencies.

Migrations:

- `prisma/migrations/20260718090000_vision_capture_b2/migration.sql`
- `prisma/mysql-migrations/0006_vision_capture_b2/migration.sql`

Generated, ignored release artifacts:

| Artifact                                                 |       Bytes | SHA-256                                                            | Signature   |
| -------------------------------------------------------- | ----------: | ------------------------------------------------------------------ | ----------- |
| `dist/The Forever Treasure Companion Setup 0.4.0-b2.exe` | 243,160,218 | `838429920b404e324167d8bf1747909582787e588c522a21c62db221291ae367` | `NotSigned` |
| `dist/win-unpacked/The Forever Treasure Companion.exe`   | 223,783,424 | `25057a9a2b23a315443351eafd04e76100f8b621604f024215d660cc9df02cbc` | `NotSigned` |

Electron Builder produced the NSIS installer, blockmap, and unpacked application successfully. Production signing and updater hardening are explicitly reserved for B-6. Windows Application Control blocked execution of the final rebuilt unsigned hash (`spawn UNKNOWN` / application-policy block). An earlier package hash passed startup/listener capability smoke before the final desktop scan proof was added; the final source main process passed the stronger renderer-to-native scan, but the final unsigned package execution is not claimed as passed.

## Final architecture

```text
Shared /vision-companion UI
  -> DesktopCapturePlatformAdapter -> context-isolated fixed IPC --+
  -> WebCapturePlatformAdapter -> signed loopback WebSocket --------+-> CompanionCoordinator
                                                                      -> one CaptureCore
                                                                         -> window-only ElectronTargetProvider
                                                                         -> sandboxed binary CaptureWorker
                                                                         -> bounded ring + quality/selection
                                                                         -> managed CreatorStorage
                                                                         -> fixed Win32 HWND/hotkey helper
```

Electron main owns target enumeration, the coordinator, tray, exact sender/origin validation, and loopback service. The hidden sandboxed worker receives only an approved `window:HWND:other_id`, uses Chromium's supported selected-window `getUserMedia` path, sends 320x180 binary analysis buffers, and drains MediaRecorder WebM chunks. The renderer has no Node or filesystem access.

Player scan defaults are five seconds at 10 FPS, configurable only within 3-8 seconds and 8-12 FPS. A frame/byte-bounded oldest-first ring holds at most 84 frames and 32 MiB. Temporal buckets plus perceptual diversity return 3-12 chronological metadata frame references. Consumption completes before pixel/luminance buffers are zero-filled.

Creator media streams into a generated `.part` inside Electron's resolved per-user `userData/companion` root, with a 2 GiB file ceiling and 10-minute command ceiling. Finalization waits for late MediaRecorder chunks, calculates SHA-256, writes a strict sidecar, and atomically promotes the artifact. Cancel/error removes partial data; preview/delete accept generated IDs only.

The evidence bundle contains frame references, sequence/timing/dimensions, quality and motion summaries, capture/core/protocol versions, target privacy metadata, and an explicit cleanup receipt. It contains no pixels, path, location classification, or replay handle.

## Architecture decisions

- ADR 0011: Electron selected-window capture coordinator and sandboxed worker.
- ADR 0012: loopback-only, exact-origin browser pairing using browser-owned ECDSA P-256 keys and signed challenges.
- ADR 0013: fixed Windows `RegisterHotKey` plus selected-HWND health/release helper with no input synthesis or general key logging.

No governing discrepancy required an unapproved architectural reinterpretation. The capability is truthfully named `ELECTRON_DESKTOP_CAPTURER`; Chromium chooses the supported Windows backend and the application does not promise a fixed lower-level implementation.

## Exact test results

| Group                                  | Result                            | Evidence                                                                                                                                                               |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting / lint / type               | PASS                              | Prettier, ESLint, and `tsc --noEmit` all exit 0                                                                                                                        |
| Application unit tests                 | PASS                              | 35 Vitest files, 106 tests                                                                                                                                             |
| Companion unit/integration/security    | PASS                              | 20 Node tests: contract/state, ring/quality, real core, storage, pairing, loopback HTTP/WebSocket, diagnostics, logs                                                   |
| Desktop boundary                       | PASS                              | 3 Node tests: fixed allowlist, development-only legacy mock, real B-2 capability shim                                                                                  |
| CJS / PowerShell parsing               | PASS                              | Every Companion/Desktop CJS file plus Windows PowerShell 5.1 parser                                                                                                    |
| Fresh database                         | PASS                              | 7 SQLite migrations; B-2 persistence verifier created/replayed/deleted one manifest with one interruption and exactly 2 audit events; no path or verification decision |
| Browser E2E                            | PASS                              | 34 cases: 26 passed, 8 intentional WebKit mutation skips; B-2 pairing/capture-only surface passed Chromium and mobile WebKit                                           |
| Full release gate                      | PASS                              | `scripts/test-all.ps1 -SkipBrowserInstall`: seed, backfill, accepted-state preservation, optimized build, two production restarts                                      |
| Real native capture                    | PASS                              | 14 captured / 6 selected; creator 983,937 bytes; five repeated scans `[3,4,2,3,3]`; 10,425,975-byte external delta; 0 orphan temp files                                |
| Browser-paired native scan             | PASS                              | 12 captured / 6 selected; real signed WebSocket proof; revoke closed/rejected subsequent request                                                                       |
| Desktop-adapter native scan            | PASS (source runtime)             | Renderer bridge -> fixed desktop IPC -> same core: 14 captured / 5 selected, `EVIDENCE_CAPTURED`, cleanup true, verification null                                      |
| Windows hotkey                         | PASS except physical key ceremony | Real `RegisterHotKey` for `Control+Shift+F10`; competitor conflict rejected; no automated input                                                                        |
| Dependency security                    | PASS                              | 0 info/low/moderate/high/critical advisories, full and production-only audits                                                                                          |
| Desktop build                          | PASS                              | Final Next production build, staged server, unpacked app, NSIS installer, blockmap                                                                                     |
| Final packaged execution               | BLOCKED                           | Host Application Control blocks the final unsigned hash; signing is B-6 scope                                                                                          |
| Sea of Thieves/display/gameplay matrix | BLOCKED rows documented           | Game was unavailable; no unsupported launch/reconfiguration was attempted                                                                                              |

The final native and desktop-adapter runs emitted Chromium `wgc_capturer_win.cc:441 Failed to start capture: -2147024809` after successful result/cleanup during source closure. All asserted capture results preceded it. It is recorded as a Chromium teardown/probe observation, not suppressed and not interpreted as a failed capture.

## Demonstration evidence

Screenshots generated by the clean release gate:

- `C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\phase-b2\companion-pairing-chromium.png`
- `C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\phase-b2\companion-pairing-webkit-mobile.png`

The complete HTML/trace/screenshot evidence root is `C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation`. The precisely documented creator/player/browser/hotkey demonstration, representative JSON outputs, and cleanup proof are in `B2_Demonstration.md`. Protocol envelopes, evidence metadata, and the error catalog are in `B2_Protocol.md`.

The native run created a real WebM, verified nonzero size and SHA-256, previewed its managed metadata path, then deleted it and confirmed an empty artifact list. No recording video was retained merely for evidence. The player and browser runs reported `rawFramesCleared: true`; the repeated scan test found no `.part` files and no active worker/recording. The persistence verifier is metadata-only and creates no media.

Failure demonstrations covered minimized/restore/close, frozen/insufficient frames, pairing expiry/replay/revocation/disallowed origin, privacy pause, cancellation, hotkey conflict, invalid paths, oversized payloads, and one-time diagnostic export. Human physical-key/game/display actions remain in `B2_Test_Plan_and_Manual_Matrix.md` and are not silently marked passed.

## Known limitations

- Sea of Thieves borderless, normal-windowed, maximized, true-exclusive-fullscreen, multi-monitor, mixed-DPI, monitor-sleep, physical key release, visual preview, and gameplay frame-time observations were not available on this host.
- Exclusive fullscreen is not guaranteed; frozen/unavailable capture gives structured guidance to restore or use Borderless Windowed. No injection fallback exists.
- Windows 11 x64 is the implemented platform. Other Windows builds/hardware and non-Windows systems are not certified by this run.
- Creator recording uses Chromium MediaRecorder WebM/VP9 where available. Capabilities report candidates and CPU metadata fallback; B-2 does not promise a dedicated hardware encoder.
- The final unsigned package is blocked by this host's Application Control policy. Signing and production updater hardening remain B-6 work.
- Raw-frame diagnostic retention is deliberately unavailable; an explicit include-frame request is rejected rather than silently retaining pixels.
- A browser refresh discards its private key and therefore requires a new explicit pairing ceremony.
- Creator database persistence requires an authenticated owner and draft waypoint; local media remains managed if that server write fails.
- B-2 performs capture quality only. Recognition, geometry, reliability grading, story progression, Studio B-3 wizard, and Captain B-5 workflow remain deferred.

## Phase B-2 exit gate

### Architecture

| Item                                                            | Status | Evidence / blocker                                                     |
| --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| One native capture core serves desktop and browser-paired modes | PASS   | One `CaptureCore` in `CompanionCoordinator`; both adapters route to it |
| Shared platform adapters remain intact                          | PASS   | B-1 abstraction preserved; strict B-2 desktop/web adapters added       |
| No duplicate capture implementation exists                      | PASS   | React, IPC, WebSocket, and tray are adapters only                      |
| Protocols are versioned and validated                           | PASS   | Literal protocol 2.0, strict envelopes/commands/results                |
| Material decisions are documented by ADR                        | PASS   | ADRs 0011-0013                                                         |

### Capture

| Item                                                                    | Status  | Evidence / blocker                                                                            |
| ----------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| User can explicitly select the Sea of Thieves window                    | BLOCKED | Explicit candidate selection passes with real Windows harness; Sea of Thieves was unavailable |
| Capture produces changing frames                                        | PASS    | Real window 14-frame native and desktop-adapter runs                                          |
| Resizing and monitor movement are handled                               | BLOCKED | Dimension/format handling is tested; physical monitor movement and DPI ceremony unavailable   |
| Minimize, restore, close, and frozen-stream behavior are detected       | PASS    | Real HWND lifecycle plus deterministic frozen test                                            |
| Creator recordings persist correctly                                    | PASS    | Real WebM/hash/manifest/pause/resume/delete plus Prisma verifier                              |
| Player scans create transient evidence bundles                          | PASS    | Native, desktop adapter, browser pairing, and core tests                                      |
| Player scan cleanup is verified                                         | PASS    | Zero-fill receipt, no disk writes, 0 orphan temp files                                        |
| Ring buffer and queues are bounded                                      | PASS    | 84-frame/32 MiB dual ceiling and eviction tests                                               |
| Capture does not noticeably degrade gameplay on representative hardware | BLOCKED | Bounded harness measurement exists; no Sea of Thieves FPS/frame-time observation              |

### Quality processing

| Item                                                                   | Status | Evidence / blocker                                                             |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Blur, exposure, duplicate, frozen-frame, and motion measurements exist | PASS   | Deterministic quality tests and real summaries                                 |
| Best-frame selection returns diverse ordered frames                    | PASS   | Temporal/diversity tests and real selection counts                             |
| Insufficient evidence is returned when too few usable frames exist     | PASS   | Black/frozen/low-count tests return capture-only insufficiency                 |
| Quality results contain explicit reasons                               | PASS   | Stable reason catalog in result summaries                                      |
| No location recognition is falsely claimed                             | PASS   | Strict enum, verification null, scans and storage checked for forbidden claims |

### Hotkey

| Item                                      | Status  | Evidence / blocker                                                                      |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| Global hotkey works                       | PASS    | Real Windows registration plus core activation path                                     |
| Key-repeat does not start duplicate scans | PASS    | `MOD_NOREPEAT`, active-session guard, toggle test                                       |
| Release ends the scan                     | BLOCKED | Helper/core release path is tested without synthesis; physical key ceremony unavailable |
| Conflict produces a useful error          | PASS    | Second owner rejected; `HOTKEY_CONFLICT` guidance                                       |
| Non-global accessible alternative exists  | PASS    | Pointer, Space/Enter hold/release, and toggle UI                                        |
| Hotkey unregisters safely                 | PASS    | Disable/shutdown/conflict smoke; health monitor can continue separately                 |

### Web Companion

| Item                                                          | Status | Evidence / blocker                                                |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Explicit pairing works                                        | PASS   | ECDSA/code/desktop approval and real paired scan                  |
| Origin is shown                                               | PASS   | Pending/approved desktop rows and structured origin field         |
| Pairing expires                                               | PASS   | Pending/session expiry tests                                      |
| Pairing can be revoked                                        | PASS   | Real socket closure and rejected re-authentication                |
| Unauthorized origins are rejected                             | PASS   | Exact-origin HTTP/upgrade tests, no ACAO response                 |
| Token replay is rejected                                      | PASS   | Challenge, sequence, and request-ID replay tests                  |
| Service is restricted to approved local interfaces            | PASS   | Listener asserts `127.0.0.1`; no LAN/wildcard binding             |
| Browser cannot request arbitrary files or unrestricted frames | PASS   | Generated IDs/one-time tokens/path tests; no player-frame command |

### Privacy

| Item                                          | Status | Evidence / blocker                                                 |
| --------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Visible capture indicator exists              | PASS   | UI, tray, status, and state events                                 |
| Pause and stop controls work                  | PASS   | Core/UI/creator/privacy tests                                      |
| Runtime frames are not retained by default    | PASS   | Memory-only ring, no disk path, cleanup receipt                    |
| Diagnostic retention requires consent         | PASS   | Include-frame request requires consent and is unsupported/rejected |
| Diagnostic bundles omit raw frames by default | PASS   | Metadata gzip integration test                                     |
| Temporary data cleanup works                  | PASS   | Startup/cancel/error/finalize/repeated scan tests                  |
| Logs contain no frame pixels or secrets       | PASS   | Fixed-field logger and adversarial log test                        |

### Reliability and errors

| Item                                                  | Status | Evidence / blocker                                          |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Structured errors are implemented                     | PASS   | Bounded developer/user/action/retry/reselection schema      |
| System failure is not labeled as wrong location       | PASS   | No `NOT_AT_TARGET` capture result; error mapping tests      |
| Target loss is recoverable or clearly explained       | PASS   | Minimize/restore recovery and close/reselect guidance       |
| Exclusive-fullscreen limitations are handled honestly | PASS   | Borderless guidance; no unsafe fallback or false health     |
| Health status is truthful                             | PASS   | HWND, dimensions, source flow, frozen and capability status |
| Duplicate completion events are prevented             | PASS   | Idempotent stop/cancel and stale-session tests              |

### Testing

| Item                                  | Status | Evidence / blocker                                                            |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Unit tests pass                       | PASS   | 106 Vitest + deterministic Node unit coverage                                 |
| Native integration tests pass         | PASS   | Real selected application-window capture lifecycle                            |
| Protocol integration tests pass       | PASS   | Desktop parity and real loopback HTTP/WebSocket                               |
| Security tests pass                   | PASS   | Origin/auth/replay/path/payload/log/diagnostic boundaries                     |
| End-to-end desktop test passes        | PASS   | Source renderer bridge -> desktop IPC -> real capture -> evidence -> cleanup  |
| End-to-end browser-paired test passes | PASS   | Real signed pairing -> capture -> revoke -> denial                            |
| Performance and leak tests pass       | PASS   | Bounded repeated harness scan; 0 orphan temp/active worker; no gameplay claim |
| Manual test matrix is documented      | PASS   | Every required row is PASS/BLOCKED with a repeatable game ceremony            |

### Documentation

| Item                                            | Status | Evidence / blocker                            |
| ----------------------------------------------- | ------ | --------------------------------------------- |
| Developer architecture documentation is updated | PASS   | `B2_Architecture.md` and B-1 boundary notes   |
| Companion protocol is documented                | PASS   | `B2_Protocol.md`                              |
| Capture-state machine is documented             | PASS   | Architecture and protocol transition contract |
| Error catalog is documented                     | PASS   | Protocol and troubleshooting records          |
| Privacy behavior is documented                  | PASS   | `B2_Security_and_Privacy.md`                  |
| User troubleshooting is documented              | PASS   | `B2_Troubleshooting.md`                       |
| Phase B-2 completion report is delivered        | PASS   | This record                                   |
| Rollback instructions are delivered             | PASS   | Below and `B2_Storage_and_Migrations.md`      |

## Rollback and safe removal

1. Set these environment flags to `0`, then restart the web server and Companion: `FEATURE_VISION_COMPANION`, `FEATURE_NATIVE_WINDOW_CAPTURE`, `FEATURE_CREATOR_CAPTURE`, `FEATURE_PLAYER_HOLD_TO_SCAN`, `FEATURE_BROWSER_COMPANION_PAIRING`, `FEATURE_CAPTURE_PREVIEW`, and `FEATURE_DIAGNOSTIC_CAPTURE`. Keep `FEATURE_MOCK_VERIFICATION_CONSUMER=0` in production.
2. Stop the Companion. Shutdown stops the worker and loopback listener, unregisters the hotkey, finalizes/cancels the active session, and zero-fills transient player buffers.
3. Deploy the B-1 source at `9c0d64557845145f3f61f25b48bcbe8d3f473a5b` or its approved successor. Do not reset a dirty worktree; create a clean worktree or normal revert.
4. Leave the additive B-2 tables/columns in place by default. They do not break B-1 reads and preserve creator/audit history. There is deliberately no automated destructive downgrade.
5. If database removal is mandatory, take and verify a backup, stop all writers, then reverse constraints/tables and rebuild altered tables during an explicit maintenance window using the pre-B-2 schemas. Never do this as an incidental application rollback.
6. Uninstall the Companion through Windows Installed Apps. Preserve wanted creator recordings first. For manual data removal, resolve Electron's actual `userData` path and remove only its `companion` child; never delete a broad AppData directory.
7. Ignored `dist`, `.desktop-bundle`, validation databases/screenshots, and temporary harness directories can be regenerated. Resolve and verify each exact target inside this worktree before removal; never use a broad recursive cleanup against a repository or user directory.

## Required follow-up to close the four blocked exit items

Run the documented human ceremony with Sea of Thieves open and the user present: explicitly select the game; test normal, borderless, maximized, exclusive, multi-monitor, resolution/DPI, minimize/restore/close, and monitor sleep; record game FPS/frame-time and Companion resource deltas across five scans and a creator recording; physically press/hold/release the configured hotkey. Record observed values and change only the corresponding `BLOCKED` rows to `PASS`.
