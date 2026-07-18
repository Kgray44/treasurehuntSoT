# ADR 0011: Electron window capture and one Companion coordinator

Status: accepted for Phase B-2

## Context

B-1 selected Electron because the shared application requires a dynamic Next.js/Prisma server and the host had no Rust toolchain. B-2 requires real user-selected Windows application-window capture for both the integrated desktop and a paired browser without duplicating capture code or moving native logic into React.

Electron exposes Windows application windows through main-process `desktopCapturer` sources and captures an approved source through Chromium media APIs. A source ID contains the HWND on Windows. This is a supported, read-only individual-window capture path and does not modify the source application.

## Decision

Create one `CompanionCoordinator` and one `CaptureCore` in the Electron main process. A dedicated hidden, sandboxed capture worker owns the media stream and MediaRecorder. It receives only a selected `window:*` source ID. It sends downscaled binary frame buffers and bounded recording chunks to the coordinator.

Desktop IPC and browser WebSocket adapters call the same coordinator commands. Target enumeration and selection occur in the main process and return sanitized candidate metadata plus small thumbnails only after an explicit user action. The app never selects a likely Sea of Thieves source silently and never offers full-display capture by default.

The capability report names the API `ELECTRON_DESKTOP_CAPTURER`. It does not assert that a particular internal Chromium capture backend is active.

## Alternatives considered

- Tauri/Rust Windows Graphics Capture: rejected because Rust is absent and B-1 already chose Electron for the same shared application.
- A new C# Windows service: rejected because no .NET SDK is installed and it would add a second build, update, and signing boundary.
- Capture in the shared React component: rejected because it would mix UI, platform, lifecycle, privacy, and resource ownership.
- Separate desktop and browser capture implementations: prohibited because behavior and security would drift.
- Full-display capture fallback: rejected because it expands privacy scope beyond the selected game window.

## Consequences

Capture has one lifecycle, quality pipeline, ring buffer, storage policy, error catalog, and test harness. Electron remains the local Companion process. A hidden renderer/GPU process can fail without corrupting Studio persistence; the coordinator detects loss, clears transient frames, and requires a safe restart.

## Security implications

The worker is sandboxed, has no Node integration, and accepts commands only from the coordinator. UI renderers cannot send worker events. Source IDs are validated as Windows window IDs and checked against the current enumerated candidate set. No arbitrary media, filesystem, process, or display command is exposed.

## Compatibility implications

The architecture is Windows-only for B-2. Future capture backends may implement the same `CaptureWorker` and `TargetProvider` interfaces without changing shared UI or protocol contracts.
