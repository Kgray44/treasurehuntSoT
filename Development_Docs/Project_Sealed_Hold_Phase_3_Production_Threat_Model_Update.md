# Project Sealed Hold Phase 3 Production Threat-Model Update

Phase 3 treats provider failure, object/database drift, stale leases, key-version loss, unsafe repair, failed backup, and restore-to-production as security events. Configuration rejects production local-provider fallback, missing required scanner/KMS/MySQL, non-TLS S3, and unsafe roots. Provider health is sanitized and role-scoped.

Backups encrypt every manifest/object envelope under a transient DEK wrapped by the selected key provider. Verification checks manifest authentication, object hashes and sizes, required key versions, and referential record closure before a result is considered verified. Restore rejects source-equivalent, canonical, and production-like targets before writing records or objects. Repair execution requires a digest-bound, expiring approval and rechecks snapshot/lease ownership.

Remaining risks are recorded as incomplete local execution work or blocked external live evidence; no simulator or adapter is treated as a production proof.
