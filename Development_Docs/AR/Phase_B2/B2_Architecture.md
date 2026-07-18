# Phase B-2 Native Companion Architecture

Application version: `0.4.0-b2`  
Capture protocol: `2.0`  
Recording manifest: `1`  
Evidence metadata: `1`

## Product boundary

Phase B-2 extends the B-1 Electron shell and shared Next.js application. It does not create a second product or a browser-owned capture implementation.

```text
Shared /vision-companion React surface
  -> DesktopCapturePlatformAdapter -> restricted context-isolated IPC ---+
  -> WebCapturePlatformAdapter -> paired loopback WebSocket -------------+
                                                                       CompanionCoordinator
                                                                         -> one CaptureCore
                                                                            -> ElectronTargetProvider
                                                                            -> sandboxed CaptureWorker
                                                                            -> bounded quality/ring pipeline
                                                                            -> CompanionStorage
                                                                            -> Windows health/hotkey monitor
```

The React layer gathers user intent and renders state. It does not own media streams, files, state transitions, quality algorithms, pairing authorization, or retention behavior.

## Process boundaries

| Boundary                | Responsibility                                                                                      | Explicitly unavailable                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Shared Next renderer    | Status, explicit target confirmation, creator/player controls, pairing ceremony, retention controls | Node, shell, arbitrary IPC, raw native frames                           |
| Electron main           | One coordinator, sender/origin validation, target enumeration, tray, loopback listener              | Game injection, memory access, input synthesis                          |
| Hidden sandboxed worker | Approved `window:HWND:other_id` media stream, downscale, MediaRecorder                              | Node, navigation, arbitrary source selection, filesystem                |
| Fixed PowerShell helper | Selected HWND health and one allowlisted hotkey preset                                              | Full keyboard logging, input suppression/forwarding, arbitrary commands |
| Loopback server         | Pairing and typed protocol adaptation                                                               | LAN binding, wildcard CORS, arbitrary paths, generic execution          |
| Next/Prisma server      | Owned draft creator-manifest persistence and audit                                                  | Player pixels, native file reads, location decision                     |

The capability name is `ELECTRON_DESKTOP_CAPTURER`. Chromium may select a supported Windows backend internally; B-2 does not claim a particular backend as an application guarantee.

## Capture state machine

The allowed states are `IDLE`, `PAIRING`, `READY`, `TARGET_SELECTION_REQUIRED`, `TARGET_SELECTED`, `STARTING`, `CAPTURING`, `PAUSED`, `FINALIZING`, `PROCESSING_CAPTURE`, `COMPLETED`, `CANCELLED`, `FAILED`, and `TARGET_LOST`.

Every transition is validated, sequenced, timestamped, correlated to a session where applicable, emitted as an event, and written to structured logs. Duplicate stop returns the prior metadata-only completion for the same session. Stale session IDs are rejected. A minimized or closed target becomes `TARGET_LOST`; restore can return a retained valid target to `TARGET_SELECTED`. A closed HWND invalidates the target.

## Target semantics

- Only `desktopCapturer.getSources({types: ["window"]})` candidates are accepted.
- The user explicitly confirms a current enumerated source; a likely Sea of Thieves label is convenience only.
- Full display capture is not offered.
- Candidate titles are sanitized and bounded. Ordinary logs never receive the title.
- Small selection thumbnails are capped; native frames are not serialized as JSON.
- B-2 targets are process-session-only. `remember: true` is rejected, and the target expires on Companion exit or invalid HWND.
- The HWND helper reports client size, minimized/restored state, and closure every 500 ms while a target exists, even when the global hotkey is disabled.

## Frame and queue architecture

The worker samples a native-size selected-window stream into `320x180` RGBA analysis frames. Electron IPC transfers binary typed arrays. Player mode inserts them into a deterministic oldest-first ring with both a frame ceiling and a 32 MiB byte ceiling. The default is 5 seconds at 10 samples/second; the governed range is 3-8 seconds and 8-12 samples/second. The ring can retain at most 84 frames.

Quality processing derives luminance, clipping, contrast, entropy, sharpness proxy, perceptual hash, near-duplicate distance, and adjacent-frame motion. Selection uses temporal buckets and perceptual diversity, preserves chronology, and returns at most 12 frame references. Continuous duplicates produce a frozen-stream result.

The B-2 capture-only consumer completes before `BoundedFrameRing.clear()` zero-fills pixel and luminance buffers. No raw player frame is written to disk, sent to the Next server, returned in protocol JSON, or retained after completion/cancel/error/shutdown.

Creator mode uses the same stream and quality path. MediaRecorder WebM chunks are drained in order into an app-managed `.part` file, capped at 2 GiB. Stop waits for asynchronous final MediaRecorder data before hashing/finalization. The completed artifact and sidecar use generated IDs; cancellation and failure remove the temporary file.

## Initial performance budgets

| Resource                   | Budget                                             |
| -------------------------- | -------------------------------------------------- |
| Player raw-frame memory    | 32 MiB hard byte ceiling                           |
| Player ring                | 84 frames maximum                                  |
| Player duration            | 3-8 seconds; 5-second default                      |
| Analysis rate              | 8-12 FPS; 10 FPS default                           |
| Evidence selection         | 3-12 metadata frame references; normal target 6-12 |
| Creator media              | 2 GiB hard ceiling; 10-minute command ceiling      |
| Pairing request body       | 32 KiB                                             |
| Incoming WebSocket message | 64 KiB                                             |
| Target candidates          | 64 maximum; bounded thumbnails/icons               |
| Authentication             | 10-second socket proof timeout                     |
| Command response           | 20-second browser adapter timeout                  |

The deterministic Electron harness measured five repeated scans with no orphan `.part` files, no active recording/worker session, and a 10,425,975-byte external-memory delta in the final recorded run. This is a harness measurement, not a Sea of Thieves gameplay-stutter claim.

## Capability and degradation model

Capabilities report OS/CPU/memory, Electron GPU devices, encoder candidates, hardware-acceleration observation, CPU metadata fallback, protocol/package versions, storage category/free bytes, modes, resolutions, preview behavior, hotkey support, and privacy budgets. They explicitly report `localInference: false`, `locationVerification: false`, and `cloudBuild: false`.

Exclusive-fullscreen reliability is not claimed. If the selected source stops, closes, minimizes, or freezes, B-2 returns a capture error or insufficient-capture result and recommends restore or Borderless Windowed. It never uses injection as a fallback.

## B-1 compatibility seam

The historical deterministic B-1 verifier remains available only as a development/test consumer. Its result endpoint is gated by `mock_verification_consumer`, which defaults off in production, and packaged Electron rejects legacy mock preparation. B-2 capture results never become B-1 verification results implicitly.
