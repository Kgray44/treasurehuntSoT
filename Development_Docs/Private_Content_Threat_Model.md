# Private Content threat model

| Threat | Asset / failure mode | Phase 1 control | Residual limitation and proof |
| --- | --- | --- | --- |
| Accidental Git exposure | Packages, keys, decrypted files, public bundles | Outside-repo root policy, ignore defense, repository/staged/build scanners, synthetic-only fixtures | Does not remediate old history; scanner and build-sentinel tests prove current protection. |
| Unauthorized HTTP access | Private media guessed by ID, stale membership, protected derivatives | Application-only route, opaque 404, authorization adapter, private cache headers, source-protection inheritance | No signed-URL/object-store service yet; route authorization tests cover anonymous, Creator, Player, and unrevealed states. |
| Package tampering | Ciphertext, envelope, manifest, checksums, versions | AES-GCM before parsing, SHA-256 checksums, zod validation, compatibility registry | Local passphrase distribution remains operational responsibility; wrong-key/tamper/version tests fail closed. |
| Malicious archive | Traversal, links, collisions, bombs, executable content | Virtual-archive path policy, normalized unique paths, count/byte/depth limits, MIME/magic validation, GLB-only model policy | No third-party antivirus; adversarial path/limit tests exercise rejection. |
| Operational secret leakage | Logs, errors, audit, shell args, temp files | Redaction policy, safe error mapper, no passphrase CLI option, randomized private staging cleanup | OS deletion is not cryptographic erasure; tests inspect error/receipt redaction and cleanup. |
| Partial import | DB/storage split, retries, races | Staging, transactions, availability gating, unique package constraints, finalization retry, cleanup | Cross-host distributed locking is not implemented; isolated tests prove planned failure paths. |
| Loss/recovery | Missing package/key, divergent DB/assets, tampered backup | Encrypted backup, package/object hashes, isolated restore verification, runbook | Key loss is unrecoverable and production backup orchestration is manual; synthetic restore/mismatch tests provide proof. |

Pre-implementation read-only scan: zero tracked private package/key/path indicators, zero sensitive-content indicator files, and zero matching historical paths. No history remediation is indicated by this limited path/content scan; any later discovery requires separately authorized remediation.
