# Harborlight Phase 4 Production Threat Model

Primary threats are report spam, moderator privilege escalation, self-moderation, IDOR, stale or forged scan receipts, object replacement after scan, quarantine bypass, unsafe package paths, private evidence disclosure, replayed mutations, provider outage, and restart loss.

Mitigations are canonical server-side account/role resolution, CSRF on mutation routes, bounded bodies and pagination, idempotency keys, optimistic revision checks, immutable evidence checksums, role-audited evidence access, provider/digest/age-bound scanner receipts, database-first quarantine, and durable outbox claiming with retry and terminal-failure state.

The system never treats synthetic scanning, a configured class name, local storage movement, or an unavailable provider as production proof. Alerts and diagnostics use safe codes only; they never include identities, titles, storage keys, credentials, report detail, appeal text, or private Chronicle material.
