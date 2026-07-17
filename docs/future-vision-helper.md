# Future vision helper boundary

Phase 1 does not perform image recognition. It prepares a narrow, auditable provider seam so a later phone/helper implementation cannot become a second progression engine.

## Reference preparation

Creators can organize assets into location or artifact collections, including positive and negative reference sets, and assign a collection to a location. Locations retain a JSON verification profile for future provider configuration. Published snapshots freeze those records and referenced asset variants with the rest of a release.

## Pairing

An authenticated Captain creates a short-lived pairing through `POST /api/helper/pair` with `sessionId` and a stable local `deviceId`. The server permits only active, published, non-preview sessions, stores a hash of the token, and returns the raw bearer token once. Tokens expire after 15 minutes. `GET /api/helper/status` acts as the scoped heartbeat: it updates presence and returns only session status, the pinned published version, current block, and current verification request. A Captain can revoke a device immediately through `DELETE /api/helper/pair/[pairingId]`; revocation is recorded as an ordered session event.

Phase 1 intentionally provides the API boundary rather than a camera UI. A future QR or numeric-code ceremony should transmit the returned token over an authenticated local channel, avoid query-string logging, and rotate/revoke on re-pair.

## Verification envelope

The helper submits `POST /api/helper/verification` with `Authorization: Bearer <pairing token>` and a versioned body:

```json
{
  "schemaVersion": 1,
  "eventId": "provider-unique-event",
  "idempotencyKey": "provider-stable-retry-key",
  "eventType": "verification.observation",
  "providerType": "visionLocation",
  "providerInstanceId": "helper-device-id",
  "sessionId": "session-id",
  "publishedVersionId": "published-version-id",
  "blockId": "current-block-id",
  "verificationRequestId": "pending-request-id",
  "observedAt": "2026-07-17T20:00:00.000Z",
  "result": "match",
  "confidence": 0.92,
  "evidence": { "referenceCollectionId": "collection-id" }
}
```

The API validates shape, bounds confidence to 0..1, updates pairing presence, applies a token-keyed rate limit without logging the token, and calls the same `submitVerification` function used by other providers. The engine binds the event to the pending request and checks session, published version, current block, provider type, and request status before advancing. Duplicate retries return the prior accepted result; contradictory or stale submissions are rejected and retained as verification evidence where appropriate. The helper never receives an unrestricted advance, jump, rollback, or Captain action endpoint.

## Simulator

`POST /api/captain/simulate` is development-only and requires a Captain session plus CSRF. It creates the same envelope and enters the same progression function with `sourceType=simulator`; it is not a shortcut or a production provider. The Captain session screen exposes match, no-match, and uncertain controls when a compatible request is pending.

## Later implementation rules

- Keep frame capture and model inference outside the authoritative web process.
- Upload derived evidence by default, not raw frames; define retention and consent before storing imagery.
- Sign provider releases and identify the provider instance/model in evidence.
- Calibrate confidence per verification profile; never interpret confidence alone as permission to progress.
- Preserve human Captain override and complete audit events.
- Add a polished pairing/revocation ceremony and encrypted device-to-server transport before real-device rollout; the scoped heartbeat, API revocation, and process-local rate guards already exist.
- Test false positive, false negative, duplicate, delayed, reordered, wrong-version, and offline/reconnect cases against the current contract suite.
