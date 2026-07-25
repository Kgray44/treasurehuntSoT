# Project Sealed Hold Phase 4 Design Record

Status: implementation in progress. This record freezes Phase 4 decisions; it is not a completion receipt.

Phase 4 is based on `origin/codex/project-sealed-hold-phase3-stand-the-watch` at `d09c16e21e3945b219420ff3fc575fac93cbe591`. At the start of work, `origin/main` was `6bd8209d2d7f0edc73da9566fd06e825ae51a602`; Wayfarer Phase 4 was `ba241a68c90f5fa5ff32b8a3fbded9ff1431d1a3`; Harborlight Phase 3 was `28e15616ff294735516d194daafbaa87d62d74ee`.

Protected originals remain `PrivateAssetObject` records in private provider storage. Phase 4 adds metadata, typed opaque associations, exact consent assertions, purpose grants, derivatives, receipts, withdrawals, and reconciliation evidence. It never publishes an original or exposes a storage key.

The policy registry is the single authorization boundary. Unknown purpose, audience, subject kind, authority, scanner state, consent state, or transformation policy fails closed. Public and unlisted sharing requires a separate, scanned derivative. The raster policy is `sealed-hold-public-image-v1`: PNG/JPEG/WebP input, 8 MiB maximum source, 8192 maximum dimension, 24 million maximum pixels, normalized orientation, bounded WebP display (2048) and thumbnail (512), and no preserved metadata.

Consent is a deterministic digest of its authority, aggregate, purpose, scopes, source identity/checksum, transformation request, final derivative identity/checksum when known, watermark, revision, and validity. `SEALED_HOLD_TEST` is rejected in production. Withdrawal revokes grants, makes future delivery unavailable, retains receipts/audit history, and does not claim deletion from already-downloaded devices.

Phase 4 uses the existing storage, scanner, key-provider, durable operation, worker, backup, and repair systems. New jobs are registered in that worker registry. SQLite reservations are `20260725160000` through `20260725163000`; MySQL reservations are `0042` through `0045`.

Non-goals include public buckets, permanent URLs, CDN purge, remote URL import, arbitrary image editing, media transcoding farms, biometric processing, and direct Wayfarer/Harborlight table mutation.
