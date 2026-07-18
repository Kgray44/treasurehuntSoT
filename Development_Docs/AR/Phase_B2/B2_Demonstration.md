# Phase B-2 Demonstration Record

## Automated real-window demonstration

Run:

```powershell
$env:NODE_OPTIONS='--unhandled-rejections=strict'
npm run companion:electron-smoke
npm run companion:hotkey-smoke
```

The Electron test creates a visible animated application window with a unique title, enumerates OS application-window sources, explicitly selects that exact candidate, and uses the production worker/core/storage/pairing modules. It is not a synthetic capture worker.

Representative successful output from Electron 41.10.2 on the audited AERO X16:

```json
{
  "area": "b2-electron-capture-smoke",
  "captureApi": "ELECTRON_DESKTOP_CAPTURER",
  "targetHealth": { "closed": false, "minimized": false, "dimensions": { "height": 505, "width": 945 } },
  "minimizeRestoreRecovered": true,
  "repeatedScans": {
    "scans": 5,
    "selectedFrameCounts": [3, 4, 2, 3, 3],
    "externalDeltaBytes": 10425975,
    "orphanTemporaryFiles": 0
  },
  "playerResult": "EVIDENCE_CAPTURED",
  "capturedFrames": 14,
  "selectedFrames": 6,
  "rawFramesCleared": true,
  "creatorBytes": 983937,
  "creatorHash": "sha256:1ca1f542f966ea66bf6ac4a1c90fcadeaae1d3f1626caceba62aca1bcc52442d",
  "creatorDeleted": true,
  "browserPairedScan": {
    "result": "EVIDENCE_CAPTURED",
    "capturedFrames": 12,
    "selectedFrames": 6,
    "revokedRequestRejected": true
  },
  "targetCloseDetected": true
}
```

Artifact bytes/hash vary by recording. The stable assertions are positive media size, SHA-256 shape, capture-only result, raw-frame cleanup, no orphan temp files, target lifecycle recovery, and revoked-pairing rejection.

Hotkey evidence:

```json
{
  "area": "b2-hotkey-smoke",
  "registered": true,
  "conflictDetected": true,
  "binding": "Control+Shift+F10",
  "interaction": "HOLD",
  "automatedInputGenerated": false
}
```

Physical key press/release is deliberately not automated. The user procedure in the test matrix is required for that final manual row.

## Desktop-integrated adapter demonstration

The final source-main smoke loads the real shared page in the sandboxed desktop renderer, invokes the fixed preload/IPC boundary, selects a separate animated Windows application window, and routes the scan through the same core:

```json
{
  "area": "desktop-smoke",
  "loaded": true,
  "shellVersion": "0.4.0-b2",
  "companionListening": true,
  "captureApi": "ELECTRON_DESKTOP_CAPTURER",
  "desktopAdapterScan": {
    "result": "EVIDENCE_CAPTURED",
    "capturedFrames": 14,
    "selectedFrames": 5,
    "rawFramesCleared": true,
    "verificationResult": null
  }
}
```

The final NSIS/unpacked build succeeds. Windows Application Control on the audited host blocks the final unsigned executable hash before process creation (`spawn UNKNOWN` / application-policy block). Signing is reserved for B-6. An earlier package hash passed startup/listener/capability smoke, but the final package execution is not claimed as passed; the source-main result above is the final integrated capture proof.

## UI demonstration

Open `http://127.0.0.1:3000/vision-companion` in the desktop shell or browser. The shared surface contains:

- integrated/paired connection and protocol/capture status;
- explicit target enumeration with bounded thumbnail and health;
- creator purpose/label/start/pause/resume/stop/cancel/manifest/preview/delete;
- player pointer/keyboard hold and toggle alternatives with live progress;
- selected-frame count, quality metadata, and raw cleanup receipt;
- privacy pause/resume and metadata diagnostic download;
- desktop hotkey presets and conflict state;
- pending origin/code approval, active pairing list, expiration, and revoke.

Every completion says capture-only and no location verification. The B-2 core has no `VERIFIED` value.

## Database demonstration

`scripts/verify-capture-foundation.ts` attaches a strict representative creator manifest to an owned draft, proves idempotent replay, reads its interruption/quality fields, verifies that neither `VERIFIED` nor a machine path was stored, tombstones deletion, and confirms exactly two correlated audit events.

## Evidence artifacts

The full release gate writes screenshots/logs under the external validation runtime returned by `scripts/dev-common.ps1`; these are generated and are not committed. Real capture media is created under a temporary OS directory by the automated smoke and deleted during cleanup. No player image is retained as demonstration evidence.

## Sea of Thieves demonstration status

No Sea of Thieves process or Microsoft Store package was available during preflight. The real-window mechanism is proven with the deterministic Windows application window, but target-game display modes, physical hotkey release, gameplay frame pacing, multi-monitor/DPI, and visual preview remain explicitly blocked manual rows. This record must not be represented as game-specific performance certification.
