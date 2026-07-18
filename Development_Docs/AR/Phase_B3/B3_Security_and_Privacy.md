# Phase B-3 Security and Privacy

## Server enforcement

- Reads require `visionWaypoint.read`; authoring and build preparation require `visionWaypoint.editDraft`.
- Permissions map to server-side creator capabilities. Hidden controls are not the security boundary.
- Every mutation requires a current CSRF token and owned waypoint version.
- Authoring writes require an expected revision and reject published/sealed versions.
- Authoring mutation payloads are limited to 512 KiB and every nested field/array/coordinate is bounded by strict Zod schemas.
- Build fixture execution is disabled in production and requires explicit `FEATURE_VISION_BUILD_ENGINE=true`.
- Mutations and BuildInput preparation create privacy-safe audit events; raw media is not copied into audit metadata.

## Companion boundary

B-3 reuses B-2 exact-origin pairing, expiring sessions, replay protection, payload limits, and restricted Electron IPC. It adds no generic command or local-path API. Studio recording buttons call the typed B-2 adapter and cannot invoke arbitrary processes.

Capture remains explicit individual-window capture. B-3 does not inject into the game, read game memory/files/network traffic, automate input, or draw an in-game overlay.

## Data minimization

- Creator media remains under the B-2 managed local application-data root.
- Studio persists hashes, sizes, bounded manifests, roles, quality, region geometry, and consent/storage states.
- BuildInput contains evidence identifiers and hashes, not raw video or unrestricted local paths.
- Local preview URLs are short-lived and obtained only through the authenticated Companion adapter.
- Player evidence behavior is unchanged from B-2 and remains memory-only.

## Integrity and deletion

New captures default to `LOCAL_VERIFIED` only because the B-2 manifest content hash was produced and validated by the managed capture path. Cloud state remains `LOCAL_ONLY` unless explicit upload authorization is present; B-3 does not upload media.

Referenced recordings cannot be deleted. Region, locked-test, and build-snapshot checks run server-side before the soft-delete audit record is written.

## Threat notes

- Stale-tab overwrites: blocked by atomic revision update.
- Cross-owner identifiers: filtered by owner on every aggregate/build/capture mutation.
- Oversized masks or notes: bounded schema plus 512 KiB route limit.
- Fake AI/reliability: no model field or score exists; health is labeled authoring coverage.
- Build escalation: production and default development configurations reject fixture execution.
- Sensitive analytics: no raw screenshots/video are sent; audit metadata uses safe allowlisted fields.

## Residual external risks

The unsigned development desktop package may be blocked by Windows application-control policy, as recorded in B-2. Public distribution still requires signing/reputation work in B-6. Real Sea of Thieves capture behavior and three-profile usability were not available during this implementation and remain validation blockers, not waived security evidence.
