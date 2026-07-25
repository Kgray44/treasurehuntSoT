# Project Sealed Hold Phase 3 Production Threat-Model Update

Phase 3 treats provider failure, object/database drift, stale leases, unknown key versions, unsafe repair, failed backup, and restore-to-production as security events. Configuration rejects production local-provider fallback, missing required services, non-TLS S3, unsafe roots, and invalid worker bounds. Provider health and operational evidence are sanitized and role-scoped.

Backups encrypt manifest/object envelopes under a transient data key protected by the selected key provider. Verification checks manifest authentication, digest, object hash/length, key versions, and referential closure before a backup is verified. Restore rejects canonical, production-like, and source-equivalent targets before any write. The accepted two-drill evidence used synthetic records, isolated roots, and the independently validated ordered SQLite migration path.

Repair is a capability with immutable stored plan, default dry-run, explicit approval/reason, expiration, source-state validation, durable lease, bounded action, safe receipt, and follow-up reconciliation. Lease loss and worker shutdown release rather than cancel durable work; only an expired crash lease may be reclaimed. Deterministic quarantine targets make copied-but-unreceipted retries idempotent. Deletion remains forbidden for live, backup, ambiguous, held, quarantined, active, unknown-key, or grace-protected objects. The full action/refusal/crash/retry matrix is locally accepted.

No synthetic provider or adapter contract is a live-provider claim. Remaining risks are limited to the separately recorded external live gates and local tooling limitations.
