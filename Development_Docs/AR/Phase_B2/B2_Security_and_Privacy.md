# Phase B-2 Security and Privacy Review

## Privacy defaults

- Capture is inactive until the user explicitly selects a window and starts a mode.
- The route header, tray tooltip, and status payload visibly distinguish active, paused, and inactive states.
- Player pixels remain in a 32 MiB in-memory ring, are consumed locally, zero-filled, and never written to disk.
- Creator WebM persists only after an explicit creator start; the UI supports preview and confirmed deletion.
- Diagnostic bundles are metadata-only in B-2. An include-frames request requires consent and is then rejected as unsupported rather than silently retaining frames.
- No cloud upload exists. `allowCloudUpload` records future authorization intent only and never initiates a transfer.
- Targets are not remembered; source IDs expire with the process or HWND.
- The service worker treats `/vision-companion` and every API route as network-owned/no-store.

## Local Companion threat review

| Threat                             | Defense and test evidence                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Malicious website requests pairing | Exact origin allowlist; no wildcard; origin shown in desktop; explicit approval/code; disallowed-origin HTTP test                   |
| Origin reuses another pairing      | Pairing and signature bind exact origin; WebSocket upgrade checks origin                                                            |
| Code/proof replay                  | Two-minute code, five-attempt ceiling, one-time pending request, fresh challenge, used-challenge set, sequence/request replay cache |
| Stolen server credential           | No symmetric server secret exists; only browser in-memory private key can sign                                                      |
| Localhost CSRF/PNA                 | Exact Origin required on every HTTP request; no credentialless origin; PNA response only for an already allowed origin              |
| Arbitrary commands                 | Fixed desktop and browser command sets plus strict payload keys; no generic execute endpoint                                        |
| Arbitrary files/path traversal     | Generated identifiers, managed roots, resolved-path checks, exact preview/download token records                                    |
| Oversized/denial payload           | 32 KiB HTTP bodies, 64 KiB inbound WebSocket, rate limiter, capture-session exclusivity, bounded source list                        |
| Protocol downgrade/malformed data  | Literal protocol 2.0 and strict runtime schemas; incompatible version errors                                                        |
| Invisible capture                  | Explicit selected target, active status, tray indicator, UI controls, state events                                                  |
| Raw frame exfiltration             | No frame protocol command, no frame JSON, only bounded small selection thumbnails and creator preview                               |
| Secret leakage                     | Logger fixed-field projection; tests prove codes/secrets/pixels/titles are dropped                                                  |
| Temporary-file leakage             | Generated `.part`, startup bounded cleanup, cancellation/failure cleanup, repeated-scan/recording tests                             |
| Stale/revoked pairing              | Expiry checks on use; persisted revocation; matching sockets closed; reauthentication test rejected                                 |

The listener is bound to `127.0.0.1` only. It is not reachable on LAN interfaces. Production includes only the packaged app origin unless the operator explicitly configures other exact origins; development additionally includes the two standard local origins.

## Electron boundary

The primary and capture renderers use context isolation, sandboxing, `nodeIntegration: false`, `webSecurity: true`, external-window denial, and same-origin navigation. Main IPC verifies the exact primary `webContents` sender and origin before dispatch. The hidden worker accepts only fixed worker commands from main and rejects navigation.

The shared application's CSP permits only the configured loopback HTTP/WebSocket Companion sources in `connect-src` and the same exact HTTP source in `media-src`. Camera, microphone, geolocation, USB, and serial remain disabled by Permissions Policy.

## Game and input boundary

B-2 does not inspect processes, memory, files, network traffic, or account data. It does not inject code, draw an in-game overlay, or automate/synthesize/suppress/forward input. `RegisterHotKey` reserves only one user-selected preset and `GetAsyncKeyState` observes only its trigger/modifiers for release. The helper emits fixed keydown/keyup state, never scan codes or typed characters.

## Logs and diagnostics

Normal JSONL logs allow timestamp, level, event, correlation/session/pairing IDs, approved origin, state transition, error code, dimensions, recovery status, and cleanup counts. They drop window titles, labels, pairing codes/signatures, tokens, arbitrary metadata, raw buffers, and notes.

Metadata diagnostic `.json.gz` bundles contain capability/status/state/error/cleanup and pairing counts/origins without credentials. Export requires a one-time five-minute exact-origin token. Raw-frame diagnostics are not implemented in B-2.

## Dependency review

The initial lock contained advisories in development tooling. Electron was moved to `41.10.2`, Electron Builder to `26.15.3`, and Concurrently to `9.2.4` within their established architecture. Final `npm audit` reports zero production and zero development vulnerabilities.
