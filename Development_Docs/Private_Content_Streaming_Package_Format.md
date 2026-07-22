# Private Content Streaming Package Format

**Status:** v1 is implemented compatibility behavior; v2 describes the implemented framing primitive and its intended integration boundary.

## Version selection

V1 is the existing bounded JSON envelope (`forever-treasure-private`, envelope/payload version 1). It uses scrypt (`N=32768`, `r=8`, `p=1`, 32-byte key) and AES-256-GCM. It carries a base64url encrypted payload and is retained only for small-package compatibility.

V2 starts with `FTH2`, then a 4-byte unsigned big-endian length and UTF-8 JSON header. The header contains `format: "forever-treasure-private-stream"`, `version: 2`, and a random `streamId`. Every subsequent item is a length-prefixed JSON frame header followed by a length-prefixed ciphertext.

## Frame rules

Each frame header has `sequence`, `kind` (`data` or `terminal`), base64url 96-bit `nonce`, `cipherBytes`, `plainBytes`, and ciphertext `sha256`. Data frames are AES-256-GCM encrypted independently. The additional authenticated data serializes `streamId`, sequence, kind, cipher length, and plain length. Frame plaintext is at most 4 MiB; an encoded record is at most 8 MiB.

Sequences start at zero and advance by one. The receiver checks record size, sequence, ciphertext length/digest, AEAD authentication, and plaintext length before accepting a data frame. A terminal frame is mandatory and contains the HMAC-SHA-256 chain digest over the original package header and every preceding encoded data-frame header/ciphertext pair. Data after terminal, a missing terminal, or a mismatched digest is invalid.

## Streaming integration contract

Transport must receive and persist encrypted bytes incrementally, report durable encrypted-byte progress, honor an abort signal, and clean incomplete staging after cancellation or failed authentication. It must not convert v2 packages or assets to base64 JSON or buffer the entire package/asset. The current `encryptPrivateFrames`/`decryptPrivateFrames` API is an in-memory testable codec, not evidence that receipt/export pipelines already meet those integration rules.

## Compatibility and evolution

Readers discriminate by magic/version. V1 limits and semantics are unchanged. Unknown versions fail closed. New V2 header fields require a version increase unless they are explicitly authenticated optional fields with defined defaults. Package/passphrase plaintext and decrypted frame buffers are transient and must not be persisted in job or telemetry payloads.
