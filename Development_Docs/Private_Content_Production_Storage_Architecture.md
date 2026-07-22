# Private Content Production Storage Architecture

**Status:** local store implemented; production S3-compatible integration remains a contract/implementation gate.

## Contract and namespaces

`PrivateStorageProvider` defines private `put`, range `read`, `exists`, immutable `promote`, quarantine move/remove, and multipart lifecycle operations. Namespaces are `uploads`, `normalized`, `objects`, `quarantine`, and `backups`; provider keys are never client-visible. Promotion must checksum-verify and never overwrite a different object.

The local implementation currently stages files outside the repository, verifies SHA-256, and promotes into a hash-addressed `objects/<2>/<2>/<sha256>` layout. It rejects unsafe roots, uses private permissions, and detects an incompatible existing destination. Its buffer-oriented staging methods are a development foundation, not proof of a large-object streaming provider path.

## Production adapter requirements

The S3-compatible adapter must keep all namespaces private, use multipart operations where available, record part tags/digests durably, abort abandoned uploads, support range reads, and report provider health. Object promotion must be immutable (copy-to-final plus checksum verification or provider equivalent). A MinIO/S3 test counts only when actually run against an isolated service; adapter existence is not a configured-provider result.

## Persistence and lifecycle

`PrivateContentUpload` records provider/key, expected/received bytes, expiry, completion/cancellation; `PrivateContentUploadPart` makes part number/digest/length durable. `PrivateAssetObject` holds provider, scan status, key, hash and finalization facts. Expired uploads, stale staging, and stale multipart sessions require explicit cleanup jobs with a grace period; ambiguous objects are quarantined or reported, not deleted automatically.

## Availability policy

Only checksum-verified, clean, authorized objects are deliverable. Immediate-revocation content uses application range streaming; a short-lived signed read is allowed only under an explicitly revocable policy. Errors and foreign/not-found outcomes are opaque.
