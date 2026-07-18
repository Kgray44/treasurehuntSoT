# Phase B-2 Test Plan and Manual Matrix

## Automated gates

| Gate                                       | Coverage                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                 | Shared feature flags, protocol schema, desktop/browser adapter parity, and all B-1 application tests                                                                                                                                                                                                                 |
| `npm run companion:test`                   | Contract/state/error rules, ring eviction/zeroization, quality/duplicate/frozen/motion selection, core player/creator lifecycle, target recovery, hotkey toggle, storage/path/cleanup, pairing crypto/replay/revocation, real loopback HTTP/WebSocket security, diagnostic one-time export, structured-log filtering |
| `npm run desktop:test`                     | Fixed IPC allowlist, rejected generic commands, development-only legacy mock seam, real B-2 capability shim                                                                                                                                                                                                          |
| `npm run companion:electron-smoke`         | Real explicit application-window enumeration/capture, HWND health, minimize/restore/close, player evidence, five repeated scans, creator WebM/hash/pause/resume/delete, actual paired WebSocket scan and revoke rejection                                                                                            |
| `npm run companion:hotkey-smoke`           | Real Windows registration/unregistration and second-owner conflict, without input synthesis                                                                                                                                                                                                                          |
| `scripts/verify-capture-foundation.ts`     | Draft ownership, transactional session/artifact/interruption persistence, idempotency, tombstone deletion, two audit events, no machine path/verification decision                                                                                                                                                   |
| `scripts/test-all.ps1 -SkipBrowserInstall` | Fresh migrations/seed, formatting, lint, types, Vitest, desktop boundary, database invariants, browser acceptance, production build and two restarts                                                                                                                                                                 |
| `npm run desktop:build`                    | Final NSIS/unpacked application build                                                                                                                                                                                                                                                                                |
| `npm run desktop:smoke`                    | Packaged renderer-to-native real scan; final unsigned hash is blocked by host Application Control, while the identical source main path passes                                                                                                                                                                       |

Native automation uses a visible deterministic animated application window, not a synthetic frame source, for the exit capture proof. Synthetic frames remain appropriate for deterministic quality edge cases.

## Required manual matrix

`PASS (harness)` means the native behavior was exercised automatically against a real Windows application window. `BLOCKED` records evidence unavailable on the audited host and is not a claim of success.

| Scenario                                  | Status                           | Evidence / remaining action                                                                            |
| ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Normal application window                 | PASS (harness)                   | Explicit candidate selected; changing frames captured                                                  |
| Maximized window                          | BLOCKED                          | Run against Sea of Thieves; harness did not maximize                                                   |
| Borderless-windowed Sea of Thieves        | BLOCKED                          | No running/install-discoverable Sea of Thieves at audit                                                |
| Normal-windowed Sea of Thieves            | BLOCKED                          | Same                                                                                                   |
| True exclusive fullscreen                 | BLOCKED                          | Must test on target game; expected fallback guidance is Borderless Windowed                            |
| Selected window resized                   | PASS (unit/health)               | Dimension-change event and interruption tested; real harness reports client dimensions                 |
| Moved between monitors                    | BLOCKED                          | Requires multi-monitor game ceremony                                                                   |
| Resolution changed                        | PASS (unit)                      | Native dimension update and `CAPTURE_FORMAT_CHANGED` metadata tested                                   |
| DPI changed                               | BLOCKED                          | Requires moving between differently scaled displays                                                    |
| Minimize / restore                        | PASS (harness)                   | Real HWND became `TARGET_LOST`, then returned to `TARGET_SELECTED`                                     |
| Target closed                             | PASS (harness)                   | Real HWND closure invalidated target                                                                   |
| Monitor sleep / restore                   | BLOCKED                          | Human hardware ceremony required                                                                       |
| Slow camera scan                          | PASS (animated harness analogue) | Changing low-motion window produced evidence; game-specific result blocked                             |
| Rapid camera motion                       | PASS (unit)                      | Motion score/reason generated; game-specific observation blocked                                       |
| Dark / bright scene                       | PASS (unit)                      | Exposure/clipping reasons tested through deterministic frames                                          |
| Nearly static scene                       | PASS                             | Frozen/duplicate result tested; insufficient evidence returned                                         |
| Multiple similar windows                  | PASS (enumeration contract)      | All candidates retained; no silent selection; target cap 64                                            |
| Global hotkey registration/conflict       | PASS (Windows smoke)             | Real `RegisterHotKey`; competitor rejected                                                             |
| Physical press/hold/release in game       | BLOCKED                          | No automated input is permitted; requires user key ceremony with game open                             |
| Mouse and keyboard accessible alternative | PASS (UI/code)                   | Pointer, Space, Enter hold/release plus toggle controls                                                |
| Companion restart                         | PASS (automated components)      | Temp cleanup/pair persistence reload tested; packaged restart covered separately                       |
| Website refresh                           | BLOCKED                          | Browser private key is session-memory; refresh intentionally requires re-pairing and needs UI ceremony |
| Desktop restart                           | PASS (production restart gate)   | Two clean Next production restarts; packaged shell smoke separate                                      |
| Pairing expiration                        | PASS (unit)                      | Pending/session expiry checks and failures                                                             |
| Pairing revocation                        | PASS (real paired harness)       | Socket closed; new proof rejected `PAIRING_REVOKED`                                                    |
| Unauthorized origin                       | PASS (loopback integration)      | HTTP 403, no ACAO header                                                                               |
| Offline local scan                        | PASS (architecture/harness)      | Real scan uses local Electron/loopback only; no cloud request                                          |
| Low disk during creator recording         | PASS (unit boundary)             | Byte/storage failures map and clean temp; physical full-disk test blocked                              |
| Repeated cancellation                     | PASS (core/storage tests)        | Idempotent cancellation and temp deletion                                                              |
| Five repeated real scans                  | PASS (harness)                   | No active worker/recording, no orphan `.part`, bounded 10,425,975-byte external delta                  |
| Privacy pause during capture              | PASS (core/UI)                   | Pauses active session; resume remains explicit                                                         |
| Creator pause/resume/preview/delete       | PASS except visual preview       | Real artifact generated/deleted; preview token/HTTP implemented; human video viewing blocked           |
| Diagnostic create/export                  | PASS (integration)               | Metadata gzip, one-time exact-origin URL, second use rejected                                          |

## Human Sea of Thieves procedure

1. Start the desktop Companion with `npm run desktop:dev` and open `/vision-companion`.
2. Launch Sea of Thieves in Borderless Windowed. Select it explicitly and record the displayed privacy label/resolution.
3. Record creator target footage for at least 10 seconds; pause/resume; stop; preview; record size/hash/quality; delete.
4. Register a non-conflicting preset. Physically hold approximately five seconds while sweeping slowly; release; record frame/selection/cleanup values. Repeat five times while watching game frame pacing.
5. Repeat for dark, bright, static, and rapid-motion scenes.
6. Resize, minimize/restore, move displays, change DPI/resolution, close, and repeat in normal/exclusive modes.
7. Pair a browser, approve the exact origin, scan, revoke, and verify the next operation is denied.
8. Record Task Manager working set, GPU utilization, game FPS/frame-time observations, handle/thread counts, and Companion data-directory temp contents before/after.

Do not mark blocked rows PASS without recording observed values. Do not launch or reconfigure the user's game without their awareness.
