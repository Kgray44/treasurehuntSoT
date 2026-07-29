# Community Harbor Phase 4 Test Plan

Focused tests cover case and appeal transitions, reporter-minimal receipts, trusted scanner receipt requirements, canonical moderator authorization, idempotent actions, self-moderation denial, and provider fail-closed behavior. Migration rehearsals use task-owned SQLite state; MySQL generation and SQL review run without credentials.

Browser, Axe, live scanner, S3/MinIO, MySQL, alerting, and full validation are separate gates. No unavailable provider or historical matrix exception is counted as passing evidence.
