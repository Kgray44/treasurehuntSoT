# Phase B-2 Storage and Database Changes

## Local Companion storage

The root is derived from Electron `app.getPath("userData")`; no user or machine path is hard-coded. `CompanionStorage` owns:

```text
companion/
  configuration/
  pairings/pairings-v2.json
  recordings/creator/artifact_<uuid>.webm
  recordings/creator/artifact_<uuid>.manifest.json
  diagnostics/diagnostic_<uuid>.json.gz
  logs/companion.jsonl
  temporary/artifact_<uuid>.part
```

Creator physical names use generated IDs. The manifest stores schema/protocol/core versions, target metadata, purpose/label, native and normalized dimensions, timestamps, duration/rate/count, quality/interruption summaries, encoding, file size, SHA-256, and retention authorization. Stop atomically moves media and manifest into the creator directory; failure removes partial finalization. Preview and deletion accept only generated artifact IDs.

Pairings persist public JWKs, exact origins, expiration/revocation, last sequence, and bounded request IDs. Codes, signatures, browser private keys, and symmetric secrets are absent.

Player frames never enter this tree. Startup removes only bounded `.part`/`.tmp` files inside `temporary`; it does not recursively clear the user-data root.

## Prisma changes

Both MySQL and SQLite schemas add creator-capture fields to `VisionCaptureSession` and `VisionRecordingAsset`, plus:

- `VisionCaptureInterruption`
- `VisionDiagnosticBundle`
- `VisionCapturePreference`

Creator manifest persistence validates ownership of a draft `VisionWaypointVersion`, stores `companion://creator/<artifactId>` rather than a machine path, creates interruption rows, and writes a correlated platform audit event in the same transaction. Content hash and session keys make retries idempotent. Local deletion marks the database asset deleted and writes a second audit event.

Migrations:

- SQLite: `prisma/migrations/20260718090000_vision_capture_b2/migration.sql`
- MySQL 8: `prisma/mysql-migrations/0006_vision_capture_b2/migration.sql`

All changes are additive. No B-1 column or record is removed.

## Retention

| Data                           | Default                                                     | User action                                               |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- |
| Player pixel/luminance buffers | Memory only; zero-filled after consumption                  | None; cannot persist through B-2 protocol                 |
| Player evidence metadata       | Returned to caller; not automatically stored by native core | Future consumer decides metadata persistence              |
| Creator WebM/manifest          | Local app data until deleted                                | Preview/delete in Companion                               |
| Creator database metadata      | Audited; deletion is a tombstone                            | Retained for explainability                               |
| Pairing metadata               | 30-minute expiry; public key only                           | Revoke in desktop                                         |
| Diagnostic bundle              | Local metadata-only archive                                 | Explicit create, download, remove from app-data directory |
| Ordinary log                   | Local fixed-field JSONL                                     | Remove with Companion user data per operator policy       |

## Rollback

1. Disable `FEATURE_VISION_COMPANION`, `FEATURE_NATIVE_WINDOW_CAPTURE`, `FEATURE_CREATOR_CAPTURE`, `FEATURE_BROWSER_COMPANION_PAIRING`, `FEATURE_CAPTURE_PREVIEW`, and `FEATURE_DIAGNOSTIC_CAPTURE`.
2. Stop the Electron Companion; this terminates capture, unregisters the hotkey, stops loopback, and clears transient player buffers.
3. Deploy the B-1 application commit. Its historical mock result remains development/test-only under the B-2 safety gate unless that specific gate is also reverted deliberately.
4. Leave additive B-2 database columns/tables in place by default. They do not alter B-1 reads and preserve audit history.
5. Only after a verified database backup and an explicit destructive maintenance window, reverse foreign keys/indexes/tables and rebuild altered tables from the pre-B-2 schema. The repository does not automate destructive downgrade SQL.
6. Local B-2 creator media can be removed through the app first. If uninstall cleanup is required, resolve Electron's actual user-data directory and remove only its `companion` child after preserving desired creator recordings. Never delete a broad AppData directory.

Generated `dist`, `.desktop-bundle`, validation databases, screenshots, and temporary harness directories are not source and may be regenerated.
