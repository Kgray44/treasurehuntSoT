# Phase B-2 User and Developer Troubleshooting

## Start the development Companion

```powershell
cd C:\path\to\the\repository
npm ci
npm run db:generate
npm run db:migrate
npm run desktop:dev
```

Open **Navigate > Vision Companion**. Use the actual repository path on the current machine; no source file contains the example path above.

## Window does not appear

- Make sure the application owns a normal visible Windows window and is not minimized.
- Press **Select Game Window** again; B-2 never selects by process/title silently.
- Prefer Sea of Thieves Borderless Windowed if exclusive fullscreen is absent or frozen.
- If the game restarted, the old HWND is invalid; select the replacement explicitly.
- A target is intentionally not remembered across Companion restarts.

## Minimized, closed, frozen, or black

- `CAPTURE_SOURCE_MINIMIZED`: restore the selected window. The retained valid HWND should return to selected state.
- `CAPTURE_SOURCE_CLOSED`: reopen and reselect; closure invalidates the target.
- `CAPTURE_FRAME_TIMEOUT` or frozen/duplicate warning: restore, expose changing content, use Borderless Windowed, and retry.
- Mostly black/dark/bright/blurred: change the scene or sweep more slowly. These are capture-quality messages, not a claim that the location is wrong.

## Hotkey fails

- `HOTKEY_CONFLICT` means another application already registered that combination. Choose another preset or use the in-app pointer/Space/Enter control.
- Application-control policy may block the fixed PowerShell helper; use the in-app control and collect a metadata diagnostic.
- Disable removes the registration but selected-window health monitoring remains active.
- Do not use an input-injection tool to test release; press and release the configured physical key.

## Browser cannot pair

- The desktop Companion must be running locally and listening on `127.0.0.1:32179`.
- Request pairing, approve the exact displayed origin in desktop, then enter the displayed six-digit code before two minutes.
- Refresh loses the in-memory browser private key by design; request a new pairing.
- Expired/revoked pairing requires a new ceremony.
- For nonstandard development/hosted origins, add the exact origin to `TALL_TALE_COMPANION_ALLOWED_ORIGINS`; never use `*`.
- Keep `NEXT_PUBLIC_COMPANION_URL` on approved `127.0.0.1` or `localhost`; CSP rejects non-loopback values.
- Browser private-network or mixed-content policies may differ for an HTTPS deployment. Validate the intended production origin/browser before release; do not weaken CORS or bind to LAN as a workaround.

## Creator recording fails

- Check free disk in capabilities and app-data permissions.
- The hard local file ceiling is 2 GiB and the command duration ceiling is 10 minutes.
- Stop waits for final encoder chunks. If the encoder/source fails, the `.part` file is removed or cleaned at next startup.
- Creator manifest server persistence additionally requires a signed-in creator, CSRF, ownership, and a draft waypoint version ID. The local recording remains available if database persistence fails.

## Diagnostics

Create **metadata-only diagnostic bundle**, then prepare and download its one-time five-minute link. It includes versions, capability/health, transition/error/cleanup, and pairing status without credentials. Raw-frame diagnostics are unavailable in B-2 even with consent.

Do not send the whole Companion user-data directory. Review a diagnostic before sharing it and use the application-managed bundle.

## Safe cleanup

Use creator **Delete** for recordings. Stop the Companion before manual maintenance. Remove only generated validation `dist`, `.desktop-bundle`, or the resolved Electron `userData/companion` child after preserving desired recordings. Never delete a broad AppData or repository root.
