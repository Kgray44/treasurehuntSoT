# Project Sealed Hold Phase 1 design record

## Freeze

Phase 1 uses the `.ftprivate` format with a version-1 JSON envelope and an AES-256-GCM encrypted, authenticated payload. The payload is a bounded virtual archive: a manifest plus content records and content-addressed asset entries. This avoids executable archive formats and arbitrary extraction while retaining explicit archive-path validation. The default package byte limit is 32 MiB; this local Phase 1 implementation intentionally rejects larger packages instead of buffering without a bound.

Keys are derived per package with Node's `scrypt` using a random 16-byte salt, N=32768/r=8/p=1, a 32-byte key, and a random 12-byte GCM nonce. The envelope carries only operational cryptographic metadata, sizes, digests, and timestamps. It contains no Tale, person, or filename data. Authentication failure always maps to `PRIVATE_PACKAGE_AUTHENTICATION_FAILED` and the same safe message.

## Trust and data boundaries

The Git repository contains generic code and synthetic fixtures only. Encrypted packages, staging, finalized private objects, backup packages, and temporary plaintext are outside the repository. Configuration rejects public, `.next`, source, repository, and relative roots. A package never contains account IDs, password hashes, sessions, invitation tokens, or other account internals. Import binds the content to the authenticated importing creator.

`PrivateContentAuthorization` is the only identity seam used by private-content services. Its baseline implementation uses the existing Creator capability and current Player/Captain session interfaces. Later Wayfarer identity changes replace that adapter, not package, storage, import, or route code.

## Core contracts

- Envelope: `format=forever-treasure-private-package`, `envelopeVersion=1`, payload version 1, `aes-256-gcm`, `scrypt`.
- Manifest: package ID/revision, application compatibility range, classification, content type, logical Tale/asset/dependency entries, and checked totals.
- Errors: typed `PrivateContentError` with a stable code, correlation ID, and safe message. Error metadata is redacted.
- Import statuses: `CREATED`, `VALIDATING`, `PLANNED`, `STAGING_ASSETS`, `COMMITTING_DATABASE`, `FINALIZING_ASSETS`, `COMPLETED`, `FAILED`, `ROLLED_BACK`.
- Conflict policy: abort destructive conflicts; an exact prior import is an idempotent receipt; a conflicting slug, logical asset ID, published version, or newer revision requires a new dry run and explicit resolution.

## Storage and delivery

`PrivateAssetStore` stages hash-verified buffers under a private staging root, then atomically finalizes them under `objects/<first-two>/<next-two>/<sha256>`. Existing objects are reused only after size/hash verification. Finalized objects are never mapped by Next static files. The private asset route returns indistinguishable 404 responses for absent and unauthorized assets, `private, no-store`, `nosniff`, and a sanitized disposition. Draft access requires a creator; Player/Captain access is delegated through the compatibility adapter and a registered reference/reveal state.

## Import, export, and recovery

Inspection decrypts, validates envelope/limits/path policy/schema/compatibility/checksums, and builds a sanitized no-mutation plan. Commit requires `confirm=true` and a fresh plan digest. Objects are staged, durable import state is written transactionally, objects are finalized, then records become available. A failed database transaction removes staging; failed finalization leaves an unavailable retryable import and no serveable reference. Package ID/revision and package SHA are unique for idempotency.

Export collects a selected private registry payload and referenced objects, refuses a repository destination, encrypts, then performs an in-memory round-trip verification. Backup reuses this package process and restore verification uses a disposable store/registry only. Imports neither publish, create a session, nor create an invitation.

## Compatibility, logging, and future seams

The compatibility registry implements v1 identity transforms and rejects unknown required versions. Asset representations include `model-3d`, but only validated GLB is accepted; no renderer is part of this phase. Pino redaction is extended for passphrases, keys, package payloads, staging roots, asset paths, and private prose. Audit receipts carry IDs, digests, safe counts, status, and correlation IDs only.

## Migration and non-goals

The private registry models are additive and isolated from Wayfarer-owned identities. A unique Sealed Hold migration is required in both schema tracks; integration must retain both branches' migrations and regenerate Prisma. Non-goals include account redesign, public sharing, automatic publishing/inviting/deployment, 2D/3D rendering, KMS/HSM, object-storage delivery, AV/transcoding, and history remediation.
