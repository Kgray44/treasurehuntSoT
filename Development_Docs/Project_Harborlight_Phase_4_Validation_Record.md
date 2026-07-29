# Project Harborlight Phase 4 Validation Record

`npm ci` completed with Node `22.13.1` and npm `10.9.2`. Focused moderation/scanner tests passed; the repository suite passed `158` files and `1100` tests; type checking, documentation validation, feature validation, private-content scan, language validation, architecture validation, and production build passed. The isolated canonical validation created `validation-20260729T121005325Z-8c54f6b5593d`, applied all 47 SQLite migrations including Phase 4, then stopped at the pre-existing formatting failure in `Development_Docs/Validation/Ledgerlight_Mainline_Cleanup_Validation.md`. That file is unchanged by this branch.

The migration engine wrapper initially failed before a diagnostic when pointed at an absolute external SQLite URL. The task-owned raw rehearsal and the canonical validation wrapper both subsequently applied the complete migration history; the latter is authoritative migration evidence. MySQL schema validation and client generation passed, but no isolated MySQL service was configured.

No live scanner, object store, MySQL, alert destination, deployed worker, or production host is configured in this worktree; none is represented as live validation.

## Current deterministic evidence

The continuation adds an additive relational-integrity migration after the
preserved Phase 4 migration. Prisma SQLite validation, Prisma MySQL validation
with a non-secret dummy URL, and SQLite client generation pass. The correction
adds foreign-key behavior for reports, report links, evidence, assignments,
events, actions, sanctions, appeals, appeal events, restoration receipts, and
case subjects. The intended SQLite rehearsal also runs `PRAGMA
foreign_key_check`; a Prisma Windows schema-engine failure that emits no
diagnostic remains under investigation and is not classified as a successful
migration rehearsal.

Focused deterministic tests cover case/appeal transition rejection, minimal
reporter receipts, current digest-bound receipts, bounded outbox backoff, and
privacy-preserving rate-limit hashing/window rollover. The current full
deterministic suite passed 161 files and 1105 tests. Type checking,
documentation validation, and Feature Catalog validation pass.

The isolated moderator browser route passed 2 tests in
`harborlight-phase4`: anonymous denial, canonical role resolution, protected
queue and case navigation, keyboard focus, mobile layout, 200% zoom,
reduced-motion behavior, serious/critical Axe checks, CSRF denial, revision
conflict, and conflict-of-interest denial. It used the nonce-bound task-owned
SQLite copy in
`Validation_Runs/validation-20260729T140952979Z-9a8f76888b31`, applied all 48
SQLite migrations, and released the owned port 3100 afterward.

This is not live-provider evidence. Isolated storage restore drills, actual
MySQL, actual ClamAV, S3-compatible storage, alert delivery, trusted deployment,
and the complete canonical validation matrix remain required before acceptance.

The logical backup command and two independent isolated restore drills passed
against the same task-owned SQLite copy. Backup identity
`harborlight-1785349234154-b747181d` verified before each write; the `drill-a`
and `drill-b` targets both restored and re-verified the logical snapshot. The
drill targets were outside the repository and distinct from backup storage.

Run locally with the task-owned Node runtime:

```powershell
npm run typecheck
npm exec vitest run src/community/moderation.test.ts src/community/rate-limit.test.ts src/community/outbox.test.ts
npx prisma validate --schema prisma/schema.sqlite.prisma
$env:DATABASE_URL='mysql://harborlight:harborlight@127.0.0.1:3306/harborlight'; npx prisma validate --schema prisma/schema.prisma
```

Do not interpret an unavailable provider, unconfigured alert destination, or
the Ledgerlight Markdown formatter finding as a Harborlight product pass.
