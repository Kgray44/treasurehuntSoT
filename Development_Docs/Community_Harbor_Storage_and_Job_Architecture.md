# Community Harbor storage and job architecture

`CommunityAssetStorageProvider` defines staged write, read, immutable copy, quarantine move, checksum, and metadata seams. The local adapter uses separate `staging`, `releases`, and `quarantine` namespaces beneath an owned root. It rejects traversal, absolute paths, separators, unsafe Unicode-like names, duplicate keys, and immutable overwrites. Staging and quarantine are never public. Asset records retain owner, checksum, declared/detected MIME, size, visibility, storage provider/key, accessibility metadata, scan state, processing state, and immutable release usage.

`SCAN_NOT_CONFIGURED` is not clean. Other scan states are NOT_REQUIRED, PENDING, SCANNING, CLEAN, SUSPICIOUS, MALICIOUS, and FAILED; processing states include UPLOADED, VALIDATING, SCANNING, PROCESSING, READY, FAILED, QUARANTINED, and REMOVED. The Phase 1 local adapter does not scan, transcode, parse 3D models, or deploy object storage.

## Isolated synthetic binary validation

Production and ordinary development publication remain fail-closed: an absent
trusted scanner returns `SCAN_NOT_CONFIGURED`, which never permits a binary
package. The only test adapter is selected explicitly by the validation harness
and is accepted only in its nonce-bound isolated database runtime. It attests
two compiled, repository-owned fixtures by exact SHA-256, byte length, detected
media type, magic bytes, and the normal PNG/GLB validators. Its receipt records
the provider, fixture identifier, checksum, sizes and media types, result,
timestamp, reason code, and validation nonce; it never logs bytes or accepts a
client-supplied scan result. It is not a malware scanner and makes no assertion
about arbitrary uploads. Production scanner/object-store/worker deployment and
operational hardening remain a later Harborlight operational phase.

Business mutations enqueue sanitized, schema-versioned outbox events inside the same Prisma transaction. Claiming uses a persisted lease owner/expiry plus conditional update; a handler can mark processed only after success. Retry increments attempts and delays availability; exhaustion records terminal failure. This is an explicit development dispatcher seam, not a production worker. A future worker may use MySQL row locks/skip-locked or a queue provider, while SQLite uses short conditional claims. Back up the database and asset root together; failed storage/DB reconciliation requires manual recovery evidence.
