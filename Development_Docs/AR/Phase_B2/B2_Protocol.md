# Phase B-2 Capture Protocol 2.0

## Envelope

Both adapters use the same logical contract. Desktop IPC supplies a command plus validated payload directly; browser transport uses this strict envelope:

```json
{
  "protocolVersion": "2.0",
  "messageType": "capture.command",
  "messageId": "message_...",
  "requestId": "request_...",
  "sessionId": "pairing_...",
  "timestamp": "2026-07-18T07:30:00.000Z",
  "sequence": 1,
  "payload": {
    "command": "capture.scan.start",
    "input": {
      "requestId": "request_player_scan",
      "attemptId": "attempt_player_scan",
      "durationMs": 5000,
      "sampleFps": 10,
      "minimumFrames": 6
    }
  }
}
```

Unknown envelope and command fields are rejected. Browser sequences must increase, request IDs cannot repeat, and the pairing origin/protocol must match.

## Operations

| Group                          | Commands                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Capability/status              | `capture.getCapabilities`, `capture.getStatus`                                                   |
| Target                         | `capture.listTargets`, `capture.selectTarget`                                                    |
| Creator                        | `capture.creator.start`, `.pause`, `.resume`, `.stop`, `.cancel`, `.list`, `.preview`, `.delete` |
| Player                         | `capture.scan.start`, `.stop`, `.cancel`                                                         |
| Privacy                        | `capture.privacy.pause`, `.resume`                                                               |
| Desktop hotkey                 | `capture.hotkey.configure`, `.disable`                                                           |
| Desktop pairing administration | `capture.pairing.pending`, `.approve`, `.list`, `.revoke`                                        |
| Diagnostics                    | `capture.diagnostic.create`, `.export`                                                           |

The browser allowlist omits hotkey configuration and pairing administration. Preview and diagnostic export return short-lived, exact-origin token URLs to one managed artifact; they never accept a path.

## Events

Authenticated browser clients and the desktop renderer receive `status`, `state`, `capture-progress`, `capture-completed`, and `capture-error`. A fresh WebSocket first receives `companion.challenge` and cannot send capture commands before successful authentication.

## Pairing proof

1. Browser generates an ECDSA P-256 key pair and sends only the public JWK with an allowed exact origin.
2. Desktop shows that origin and a random six-digit, two-minute code.
3. User approves in desktop and enters the code in the browser.
4. The pairing is origin-bound, expires after 30 minutes, and persists only public/replay metadata.
5. WebSocket sends a 256-bit random challenge.
6. Browser signs `challenge|pairingId|origin|2.0` with ECDSA P-256/SHA-256.
7. Revocation closes matching sockets; expiration, signature failure, reused challenge, duplicate request ID, or non-increasing sequence is rejected.

No pairing secret, code, signature, cookie, or private key is logged or stored by the Companion.

## Capture-only result

The only B-2 result values are:

- `EVIDENCE_CAPTURED`
- `INSUFFICIENT_CAPTURE_EVIDENCE`
- `CAPTURE_CANCELLED`
- `CAPTURE_ERROR`

Representative player completion:

```json
{
  "sessionId": "scan_...",
  "result": "EVIDENCE_CAPTURED",
  "reasons": [],
  "captureOnly": true,
  "verificationResult": null,
  "evidenceBundle": {
    "schemaVersion": 1,
    "protocolVersion": "2.0",
    "captureApi": "ELECTRON_DESKTOP_CAPTURER",
    "selection": {
      "algorithmVersion": "b2-temporal-diversity-1",
      "selectedFrameCount": 7,
      "frames": [{ "frameRef": "frame_scan_..._3", "sequence": 3, "capturedAtMs": 0, "width": 320, "height": 180 }]
    },
    "retention": {
      "rawFramesWrittenToDisk": false,
      "transientFramesCleared": true,
      "replayable": false
    },
    "verification": { "performed": false, "outcome": null }
  }
}
```

Frame references are metadata receipts, not arbitrary frame-download handles.

## Error catalog

Errors contain `code`, bounded developer message, user title/message, recommended action, retry/reselection flags, and diagnostic availability.

| Area                       | Codes                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target/stream              | `CAPTURE_SOURCE_NOT_SELECTED`, `CAPTURE_SOURCE_CLOSED`, `CAPTURE_SOURCE_MINIMIZED`, `CAPTURE_SOURCE_UNAVAILABLE`, `CAPTURE_PERMISSION_DENIED`, `CAPTURE_FORMAT_CHANGED`, `CAPTURE_FRAME_TIMEOUT`                                             |
| Quality/resource           | `CAPTURE_INSUFFICIENT_FRAMES`, `CAPTURE_EXCESSIVE_BLUR`, `CAPTURE_EXCESSIVE_DUPLICATES`, `CAPTURE_EXCESSIVE_MOTION`, `CAPTURE_INSUFFICIENT_MOTION`, `CAPTURE_STORAGE_UNAVAILABLE`                                                            |
| Lifecycle/privacy          | `CAPTURE_ALREADY_ACTIVE`, `CAPTURE_NOT_ACTIVE`, `CAPTURE_PRIVACY_PAUSED`, `CAPTURE_REQUEST_STALE`                                                                                                                                            |
| Pairing/transport          | `PAIRING_REQUIRED`, `PAIRING_EXPIRED`, `PAIRING_REVOKED`, `PAIRING_CODE_INVALID`, `PAIRING_REPLAY_REJECTED`, `ORIGIN_NOT_ALLOWED`, `PROTOCOL_INCOMPATIBLE`, `COMPANION_UNAVAILABLE`, `COMPANION_RATE_LIMITED`, `COMPANION_PAYLOAD_TOO_LARGE` |
| Hotkey/diagnostic/artifact | `HOTKEY_CONFLICT`, `HOTKEY_UNAVAILABLE`, `HOTKEY_RELEASE_LOST`, `DIAGNOSTIC_CONSENT_REQUIRED`, `ARTIFACT_NOT_FOUND`, `ARTIFACT_PATH_INVALID`                                                                                                 |
| Boundary                   | `VALIDATION_FAILED`, `INTERNAL_ERROR`                                                                                                                                                                                                        |

System or capture failures never become `NOT_AT_TARGET` or `VERIFIED`.
