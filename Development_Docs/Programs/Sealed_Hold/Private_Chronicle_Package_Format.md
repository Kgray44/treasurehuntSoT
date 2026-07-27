# Private Chronicle package format v1

`.ftprivate` is UTF-8 JSON with exactly `envelope` and base64url `payload` fields. The package file itself is unencrypted only at the envelope layer. The encrypted payload is AES-256-GCM ciphertext, and the envelope authenticates all visible metadata as GCM additional authenticated data.

The decrypted payload is JSON: `{ manifest, entries }`. `entries` maps validated relative paths to base64 data. Required entries are `manifest.json`, `content/tales.json`, `assets/index.json`, and `checksums.json`; asset objects use `assets/objects/<sha256>.<approved-extension>`. There is no executable extraction step. Entry paths reject absolute/UNC/drive/traversal/null/reserved/case-colliding values, nested archives, source/script extensions, and over-limit counts/sizes.

The manifest is private and declares package/revision, format/version compatibility, `private` classification, content kind, logical Tales/assets/dependencies, and totals. Every content entry has a SHA-256 checksum. Asset paths are metadata only: storage derives solely from the validated object SHA. Original filenames are optional private metadata and never form a storage path.

The unencrypted envelope includes format/version, cipher/KDF/KDF parameters, salt, nonce, tag, encrypted byte count/digest, and timestamp. It must not include titles, people, filenames, descriptions, riddles, or notes. V1 rejects unsupported required fields/versions rather than guessing. Future versions are registered explicitly in `compatibility.ts`.
