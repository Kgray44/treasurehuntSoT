# Phase B-2 Preflight Audit

Status: complete before implementation  
Audit date: 2026-07-18  
Canonical repository: `https://github.com/Kgray44/treasurehuntSoT.git`  
Implementation branch: `codex/phase-b2-native-capture`  
Base branch: `origin/codex/phase-b1-foundation`  
Base commit: `9c0d64557845145f3f61f25b48bcbe8d3f473a5b`

## Authority reviewed

The implementation is governed, in order, by:

1. `TT-VISION-GOV-001` version 1.0, especially chapters 7, 14, 43, 50, and 57.
2. `TT-VISION-PHASE-B-001` version 1.0, chapter 8.
3. The Phase B-2 implementation prompt supplied on 2026-07-18.
4. The accepted Phase B-1 ADRs and implementation records.
5. Existing repository security, test, and finalization rules.

The two governing PDFs in `Development_Docs/AR` are byte-identical to the source PDFs preserved in the original `main` checkout. Their SHA-256 values are:

- Governing specification: `3AFEED4F9D267E1A2B670473BE337FDE55129190D1CAD24992E25B3295AF1007`
- Phase B roadmap: `4382680E77C3BA45753C5CF253DDEC6B5E6BE66F214B90957435358C8FF319DD`

PDF metadata, extracted text, and rendered pages were reviewed. The B-2 authority requires a genuine selected-window capture, bounded player scans, creator recording, quality-only evidence, secure local pairing, visible privacy state, and no location decision.

## Repository and concurrent-work state

The original checkout is on `main` at `481dc92d26af82f53769bb844fb5359c4766cb5b`, exactly matching `origin/main`. It retains the two governing source PDFs as untracked user files. It is not used for B-2 implementation.

The completed B-1 worktree is clean on `codex/phase-b1-foundation` at `9c0d64557845145f3f61f25b48bcbe8d3f473a5b`, exactly matching `origin/codex/phase-b1-foundation`. B-2 was created as the separate worktree `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B2`, with no changes to either `main` or the preserved B-1 worktree.

The previously concurrent Tall Tale UI task is already integrated into B-1. No active overlapping work was found during this audit.

## Phase B-1 verification

B-1 established the required seams rather than a second product:

- one Next.js application shared by browser, PWA, and Electron;
- one `VisionPlatformAdapter` boundary;
- strict protocol 1.0 messages and governed errors;
- additive SQLite/MySQL Vision entities;
- immutable waypoint publication and exact story binding;
- restricted Electron preload IPC;
- typed, server-enforced feature flags;
- deterministic mock inference with real persistence, stale checks, and idempotent story delivery.

The B-1 completion record reports a clean release gate with 6 SQLite migrations, 33 Vitest files and 102 tests, 2 desktop bridge tests, 24 Playwright passes with 8 intentional WebKit mutation skips, an optimized build, two restart proofs, Electron packaging, and packaged smoke. B-2 must preserve those results while replacing only the authorized capture boundary. B-2 capture logic must never emit `VERIFIED`, `NOT_AT_TARGET`, or any automatic story-progress decision.

## Existing native capability audit

| Capability             | Pre-B-2 state                                                           | B-2 implication                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop shell          | Electron 41, sandboxed renderer, context isolation, no Node integration | Extend the existing shell; do not create another frontend.                                                                                               |
| Native bridge          | Three B-1 mock/diagnostic commands                                      | Replace with a narrow capture command set; retain input validation and sender checks.                                                                    |
| Window capture         | Absent                                                                  | Use Electron/Chromium's supported Windows individual-window `desktopCapturer` source plus `getUserMedia` in a dedicated hidden worker.                   |
| Source identity        | Absent                                                                  | A `DesktopCapturerSource` uses `window:HWND:other_id` on Windows, permitting fixed Win32 lifecycle checks without title matching.                        |
| Global shortcut        | Absent                                                                  | Electron detects registration conflicts and activation, but exposes no key-release callback. A scoped Windows monitor is required for true hold/release. |
| Tray                   | Absent                                                                  | Add an app-owned tray indicator and pause/stop menu while capture is active.                                                                             |
| Browser pairing        | Absent                                                                  | Add a loopback-only authenticated service; never expose the native core directly to a remote origin.                                                     |
| Creator artifact store | Schema foundation only                                                  | Use the per-user Electron application-data root, generated IDs, hashes, bounded streaming, and narrow preview/delete operations.                         |
| Player evidence        | Metadata schema foundation only                                         | Keep downscaled frame buffers in memory and erase them after capture-only consumption.                                                                   |

The official Electron API documents `desktopCapturer.getSources({ types: ['window'] })`, main-process-only enumeration, and use of the returned source ID with `getUserMedia`. Electron also documents that the Windows source ID contains the HWND. This is an equivalent supported Windows window-capture path under governing section 14.1. The implementation will identify it honestly as `ELECTRON_DESKTOP_CAPTURER`; it will not claim a specific lower-level Chromium backend.

## Host and toolchain audit

The audited host is Windows 11 Home 64-bit, build 26200, on a GIGABYTE AERO X16 with 32 GB RAM, an AMD Ryzen AI 7 350 (8 cores/16 logical processors), an NVIDIA GeForce RTX 5070 Laptop GPU, and integrated AMD Radeon graphics.

- Node 24.18.0 and npm 11.9.0 are available.
- Electron 41.0.2 was the audited baseline. The implementation validation subsequently moved within the same major line to 41.10.2 to clear published development-tool advisories.
- .NET runtimes 7, 8, and 9 are installed, but no .NET SDK is installed.
- Rust, Cargo, MSVC `cl`, and CMake are not installed.
- PowerShell 5.1 can host a fixed, source-controlled C# P/Invoke helper through `Add-Type` without administrator access.
- No running Sea of Thieves process or Microsoft Store package was found at audit time. A Steam installation may still exist; real-game manual evidence must be recorded only if a selectable game window is available during final demonstration.

Installing a new Rust, C++, or .NET SDK would add a second native build and distribution system without improving the already selected Electron boundary. B-2 will therefore use Electron's supported capture API and a narrowly scoped PowerShell/Win32 monitor for the two capabilities Electron does not expose: selected HWND health and key-up notification.

## Transport audit and decision

The existing desktop path is authenticated by the Electron process boundary and a fixed preload allowlist. B-2 keeps that path and routes every command to one `CaptureCore` instance.

The browser path will use a second adapter over a loopback-only WebSocket service owned by the same Companion coordinator:

- bind only to `127.0.0.1`;
- exact configured origin allowlist, never wildcard CORS;
- explicit short-lived pairing request visible in desktop UI;
- user-entered pairing code;
- persisted public keys only; browser private keys remain in session memory;
- per-connection challenge authentication;
- expiring session, revocation, request IDs, monotonic sequence, replay cache, rate limits, and payload limits;
- protocol negotiation before capture commands;
- no generic command, path, or full-resolution-frame endpoint.

Desktop IPC and browser WebSocket messages share protocol 2.0 and the same command handlers. Protocol 1.0 remains available to the existing B-1 mock flow; B-2 capture does not silently reinterpret B-1 verification results.

## Native process and resource boundary

```text
shared Next.js UI
  -> DesktopCaptureAdapter -> restricted Electron IPC ----+
  -> WebCompanionAdapter -> paired loopback WebSocket ----+--> CompanionCoordinator
                                                            -> one CaptureCore
                                                               -> TargetProvider
                                                               -> hidden sandboxed capture worker
                                                               -> bounded frame/quality pipeline
                                                               -> creator artifact store
                                                               -> evidence/diagnostic services
                                                               -> scoped Win32 health/hotkey monitor
```

The hidden capture worker receives only an approved source ID and capture configuration. It returns downscaled pixel buffers and bounded WebM chunks over binary Electron IPC. Full frames do not travel through JSON. Player frames never use disk. Creator files are streamed only into the managed per-user artifact directory.

## Safety boundary

B-2 will not:

- inject into Sea of Thieves or any other process;
- read game memory, files, network traffic, or account data;
- synthesize, suppress, or forward keyboard/mouse/controller input;
- create an in-game overlay;
- silently choose a window;
- capture an entire display by default;
- upload raw frames;
- return `VERIFIED` or label a capture failure as a wrong location.

The key monitor observes only the configured key and required modifier state, emits only press/release state, records no text, never suppresses input, and shuts down with the Companion. Registration failure is surfaced as `HOTKEY_CONFLICT`; the in-application hold/toggle control remains available.

## Preflight conclusion

The B-1 architecture can support B-2 without a second frontend or duplicate capture implementation. The selected architecture is implementable on the audited host, packages with the existing Electron runtime, preserves the strict native-command boundary, and provides honest degradation when real game/display conditions cannot be captured. ADRs 0011 through 0013 record the material decisions before implementation begins.
