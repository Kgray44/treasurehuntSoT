# Community Harbor Phase 4 Test Plan

Focused tests cover case and appeal transitions, reporter-minimal receipts, trusted scanner receipt requirements, canonical moderator authorization, idempotent actions, self-moderation denial, and provider fail-closed behavior. Migration rehearsals use task-owned SQLite state; MySQL generation and SQL review run without credentials.

`tests/e2e/harborlight-phase4.spec.ts` is the isolated authenticated moderator acceptance journey. It proves anonymous denial, protected queue and case navigation, keyboard focus, mobile layout, 200% zoom tolerance, reduced-motion rendering, serious/critical Axe checks, CSRF denial, revision conflicts, and conflict-of-interest case denial. It runs only in the `harborlight-phase4` Playwright project through the task-owned validation runtime.

`npm run community:backup` creates a checksummed logical snapshot only in an isolated external root. `npm run community:restore-verify -- <backup-id> <drill-a> <drill-b>` requires exactly two distinct isolated logical restore targets and verifies each snapshot before reporting a drill result.

Live scanner, S3/MinIO, MySQL, alerting, trusted Linux/systemd deployment, and the complete canonical validation matrix remain separate gates. No unavailable provider, historical matrix exception, or inherited formatter finding is counted as passing evidence.
