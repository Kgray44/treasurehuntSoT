# Project Sealed Hold Phase 4 Integration Manifest

## Sealed Hold-owned contracts

- `src/private-content/media/contracts.ts`: opaque media, derivative, grant, consent, withdrawal, and purpose types.
- `src/private-content/media/service.ts`: durable registration, association, derivative request, exact-consent submission, and withdrawal workflow.
- `src/private-content/media-worker-composition.ts`: build, verify, grant reconciliation, withdrawal/cleanup convergence, and integrity reconciliation executors.
- `src/app/api/studio/private-content/media/route.ts`: Creator + CSRF owner surface; it passes the exact consent assertion identifier into the durable request.
- `src/app/api/private-content/media/public/[opaqueId]/route.ts`: application-mediated public opaque delivery, revision binding, source/derivative scan gates, redacted 404 failure behavior, and bounded cache headers.

## Consumer boundaries

- Wayfarer supplies opaque display-case identity, owner/revision assertion, and the exact consent assertion through its port. It receives only opaque derivative references and checksums.
- Harborlight supplies opaque voyage-log identity, publication revision, visibility-to-purpose mapping, and its exact consent assertion through its port. It receives no protected source object identity or storage key.
- No project may choose a storage provider, path, bucket, source filename, or direct object URL. Every delivery remains application-mediated and grant/revision checked.

## Operational boundaries

Phase 4 records are included in the Phase 3 backup record set. Key lifecycle helpers preserve retire/unavailable fail-closed behavior. Reconciliation is recordable and quarantines/revokes unsafe derivative/grant state without deleting forensic objects; physical retirement remains the retention scheduler's responsibility.
