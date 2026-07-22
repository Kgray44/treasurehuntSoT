# Private Content Key Management

**Status:** envelope-key interface and development provider implemented; no production KMS is configured by this record.

## Envelope model

Normalized retry objects use a random 32-byte data-encryption key (DEK) and authenticated encryption. `PrivateKeyProvider.wrap` returns a provider name, key version, AES-256-GCM algorithm label, and wrapped key; `PrivateContentWrappedKey` and `PrivateContentEncryptedPayload` reserve durable metadata for this relationship. Payload objects retain object key, SHA-256, byte length, cipher, and wrapped-key reference.

The local development provider wraps a DEK with AES-256-GCM under an injected 32-byte master key and a random 96-bit nonce. It verifies provider/version before unwrapping and treats malformed/tampered material as authentication failure. The master key must not be committed, logged, or used as production key management.

`UnconfiguredProductionKeyProvider` is an intentional truthful adapter: health is unconfigured/unhealthy and all cryptographic actions fail closed. It is not a KMS implementation claim.

## Rotation and retirement policy

Rewrap unwraps with the old version and wraps with the current version. A resumable durable job must record progress/idempotency and preserve the old wrapped key until object access and an isolated restore verify the replacement. Retirement requires no remaining references, verified backup/restore compatibility, and an approved retirement gate. Unknown key versions deny access and surface through reconciliation.

## Compatibility

`PrivateContentImport.contentJson` remains nullable for dual-read migration compatibility. New normalized retry writes must not put full plaintext payloads there. A backfill must authenticate/decode an eligible legacy row, encrypt/store normalized data, verify it is readable, then clear or tombstone the legacy plaintext only after success; the compatibility column is not destructively removed in Phase 2.
