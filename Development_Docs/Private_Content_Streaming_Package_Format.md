# Private Content Streaming Package Format

**Status:** v1 is bounded compatibility behavior. Under the 2026-07-22 owner-authorized amendment, v2 is completed in place: no non-synthetic persisted or distributed v2 package was found in repository files, history, fixtures, or documentation.

## Owner-authorized complete v2 package contract

The `FTH2` header is UTF-8 JSON bounded to 64 KiB and contains only opaque package/transport metadata: package ID/revision, random stream ID, UTC creation time, AES-256-GCM parameters, scrypt (`N=32768`, `r=8`, `p=1`, 32-byte key, 16-byte random salt, 64 MiB maximum), and record-format v1. The exact UTF-8 passphrase is used without trimming or normalization; it is transient and never becomes a retry key.

Every data frame carries exactly one record: a 4-byte metadata length, JSON metadata, and payload. Manifest is first and unique; files are non-interleaved `file-start`, contiguous `file-chunk`, `file-end` sequences. Paths, IDs, byte counts, checksums, manifest declarations, and terminal receipt are validated. Frame AAD deterministically binds the exact-header SHA-256, package ID, stream ID, sequence, kind, cipher bytes, and plain bytes. The terminal authenticates the header/data chain plus record/file/plaintext/manifest counts; trailing bytes fail.

## Version selection

V1 is the existing bounded JSON envelope (`forever-treasure-private`, envelope/payload version 1). It uses scrypt (`N=32768`, `r=8`, `p=1`, 32-byte key) and AES-256-GCM. It carries a base64url encrypted payload and is retained only for small-package compatibility.

V2 starts with `FTH2`, then a 4-byte unsigned big-endian length and UTF-8 JSON header. The header contains `format: "forever-treasure-private-stream"`, `version: 2`, and a random `streamId`. Every subsequent item is a length-prefixed JSON frame header followed by a length-prefixed ciphertext.

## Frame rules

Each frame header has `sequence`, `kind` (`data` or `terminal`), base64url 96-bit `nonce`, `cipherBytes`, `plainBytes`, and ciphertext `sha256`. Data frames are AES-256-GCM encrypted independently. The additional authenticated data serializes `streamId`, sequence, kind, cipher length, and plain length. Frame plaintext is at most 4 MiB; an encoded record is at most 8 MiB.

Sequences start at zero and advance by one. The receiver checks record size, sequence, ciphertext length/digest, AEAD authentication, and plaintext length before accepting a data frame. A terminal frame is mandatory and contains the HMAC-SHA-256 chain digest over the original package header and every preceding encoded data-frame header/ciphertext pair. Data after terminal, a missing terminal, or a mismatched digest is invalid.

## Streaming integration contract

Transport receives authenticated V2 bytes incrementally through the durable multipart path, reports encrypted-byte progress, honors cancellation, and removes incomplete protected staging after failure. `LocalPrivatePackageV2Sink`, `stagePrivatePackageV2`, and `encryptPrivatePackageV2FromSource` are persistent transport evidence; they do not convert V2 package or asset bytes to base64 JSON or buffer a complete package or asset. Legacy in-memory helpers remain codec tests only.

## Compatibility and evolution

Readers discriminate by magic/version. V1 limits and semantics are unchanged. Unknown versions fail closed. New V2 header fields require a version increase unless they are explicitly authenticated optional fields with defined defaults. Package/passphrase plaintext and decrypted frame buffers are transient and must not be persisted in job or telemetry payloads.
