# Project Sealed Hold Phase 3 Operations Runbook

Use a restricted server-side environment file. Start web and worker separately and run provider readiness before enabling mutations. A blocked readiness result is fail-closed: do not substitute a local production fallback, mark scanner failure clean, or expose provider configuration.

Operational status is Administrator-only and remains an opaque safe projection. It may show readiness state/codes, sanitized backup/restore/repair summaries, and safe action counts. It must not return or log a storage key, endpoint, private root, key material, private package content, signed URL, or raw provider response. The readiness POST is a read-only probe; repeated requests create no durable operation and do not accept an idempotency key.

For reconciliation, create a bounded read-only finding set. Persist a digest-bound **dry-run** plan; review exact action count, expiry, risk, and source-state digest. An authorized Administrator supplies a reason and approves the stored digest. The worker loads that plan, claims its lease, rechecks ownership at each bounded action/receipt boundary, and leaves an interrupted claim retryable for a replacement worker. Never accept browser-supplied replacement actions or perform broad prefix deletion.

Backups use a source database identity, canonical-record digest, object-set digest, and required key versions. Retention may delete a recovery point only after verification and never the newest verified point. Restore only to a newly created isolated environment/database/root; verify hashes, mappings, clean/quarantine states, authorization behavior, and absence of publication/session/invitation/Community side effects before recording the receipt.

For graceful owned-worker shutdown, stop claiming new jobs first. Allow an atomic safe unit to settle only while its lease remains owned; otherwise release durable progress safely for retry. Do not delete locks, shared runtime directories, provider objects, or data outside a named isolated target. A controlled Windows-owned web restart and replacement-worker handoff are local evidence; Linux systemd restart proof remains external.
