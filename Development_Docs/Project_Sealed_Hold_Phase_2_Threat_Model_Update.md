# Project Sealed Hold Phase 2 Threat Model Update

**Status:** implementation-grounded update; not an acceptance claim.
**Scope:** private package import, private assets, and the Phase 2 durable-operation foundation.

## Trust boundaries

| Boundary                     | Required control                                                | Current implementation record                                                                       |
| ---------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Package author to server     | authenticated v1 envelope; bounded schema/path/media validation | Implemented for bounded v1 payloads in `package.ts`.                                                |
| Streaming sender to receiver | ordered, authenticated framed v2 container                      | Framing primitive exists in `streaming.ts`; end-to-end streaming receipt is not yet recorded here.  |
| Server to object storage     | private root/namespace, checksums, immutable promotion          | Local hash-addressed staging/finalization exists; provider-neutral production adapter work remains. |
| Retry data to worker         | server encryption and wrapped DEK                               | Schema/contracts are reserved; legacy `contentJson` remains the current retry source.               |
| Asset to consumer            | canonical authorization plus clean scan state                   | Required policy; full delivery enforcement is not yet evidenced by this record.                     |

## Principal threats and controls

- Wrong passphrases, envelope tampering, and checksum substitution fail closed through AES-256-GCM, scrypt, authenticated metadata, and SHA-256 checks.
- Archive traversal, duplicate/case-folded paths, unsupported media, incorrect declared lengths, and oversized inputs are rejected before storage. The v1 limits are deliberate compatibility limits.
- V2 rejects bad magic, oversized length prefixes, sequence gaps/reordering, duplicate frames, corrupt ciphertext, malformed terminal data, and truncation. Its current helper is bounded by a 4 MiB plaintext frame and 8 MiB encoded record limit.
- Storage-root configuration rejects relative roots and repository/public/build/source roots. Local files use private modes and hash-addressed destinations; a digest mismatch prevents promotion.
- Unconfigured or failed scanning is not clean. `NOT_CONFIGURED`, `FAILED`, `SUSPICIOUS`, and `MALICIOUS` must remain unavailable and produce opaque delivery denial.
- A wrapped key is AEAD-protected. The development local provider rejects provider/version mismatch and tampering; it is explicitly not a production KMS.
- Operation/job identifiers, correlation IDs, idempotency keys, leases, and durable progress are retained in Phase 2 tables. Passphrases must never be placed in those records, URLs, logs, outbox payloads, or browser persistence.

## Ownership and non-goals

One Voyage owns Chronicle and runtime state; Wayfarer owns identity/privacy; Harborlight owns Community publication; Lanternwake owns animation truth. Sealed Hold does not create a Tale Session, invitation, Community Listing, or Community Release as an import side effect. A 3D renderer is out of scope.

## Residual work and review gates

The following remain gates, not satisfied assertions: normalized encrypted retry-data migration; production provider/KMS/scanner exercise; canonical materialization and conflict proof; end-to-end stream backpressure/cancellation; authorization/range delivery; backup/restore; reconciliation/GC; and browser accessibility verification. Security review must re-evaluate this document after each is implemented.
