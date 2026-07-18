# ADR 0013: Scoped Windows hotkey and selected-window health monitor

Status: accepted for Phase B-2

## Context

Electron's `globalShortcut` reports activation and registration conflict but does not expose key release. B-2 requires press-and-hold initiation, release-to-finalize, repeat suppression, conflict reporting, and selected-window minimize/close/resize health. The Windows capture source ID includes the HWND, but Electron does not expose `IsIconic` or the target client rectangle.

The audited host has PowerShell 5.1 and .NET Framework compilation support but no Rust, C++, or .NET SDK.

## Decision

Ship a fixed PowerShell sidecar that compiles one source-controlled C# Win32 interop surface in memory with `Add-Type`. It uses:

- `RegisterHotKey` with `MOD_NOREPEAT` to detect conflicts;
- `GetAsyncKeyState` to poll only the configured trigger key and required modifiers for down/up state;
- `IsWindow`, `IsIconic`, and `GetClientRect` for the selected HWND;
- a message loop and bounded health heartbeat;
- newline-delimited, fixed-shape JSON over standard output.

The Electron coordinator launches it hidden with a fixed script path and validated numeric arguments. There is no generic script, command, or process-launch API. The monitor emits no typed text, scan code, full window title, or unrelated key event.

The helper itself owns conflict detection so registration and release observation use one authority. When the hotkey is disabled, the helper restarts in health-only mode for the currently selected HWND. The UI also provides a local mouse/keyboard hold button and toggle accessibility mode.

## Alternatives considered

- Electron `globalShortcut` only: rejected because release cannot end the scan.
- Polling all keyboard state from JavaScript: rejected because Electron exposes no safe global key-state API. The fixed monitor polls only the chosen preset.
- Native npm keyboard-hook dependency: rejected because it adds ABI-specific binaries and rebuild/signing risk to Electron 41.
- Input injection or game binding: prohibited.
- Logging the full keyboard stream: prohibited and unnecessary.

## Consequences

The monitor is Windows-only and may be blocked by local application-control policy. Such a block is a truthful `HOTKEY_UNAVAILABLE` state; it does not disable the in-application control. Hotkey disable unregisters the binding while preserving selected-window health monitoring; Companion shutdown or app exit terminates the helper. A maximum scan duration and coordinator cleanup cover lost release events.

## Security implications

The monitor has no administrator requirement, does not attach to the game, does not inject a DLL, and does not synthesize, suppress, forward, or log input. Only an allowlisted preset's modifier/key combination is accepted by the coordinator. Compatibility with a game's own binding for the same reserved global combination remains a manual test item.

## Compatibility implications

Future signed native helpers may replace the script behind the same `HotkeyService` and `TargetHealthProvider` interfaces. Public distribution still requires signing and reputation testing in Phase B-6.
