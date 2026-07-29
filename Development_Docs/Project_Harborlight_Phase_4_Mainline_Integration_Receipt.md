# Project Harborlight Phase 4 Mainline Integration Receipt

Status: integration validation in progress; external-provider gates remain pending.

## Source and merge

- Source branch: `codex/project-harborlight-phase4-secure-the-harbor`
- Source tip: `171d699cbab0def827bd13f56e4901e10509ca6e`
- Base `origin/main`: `3699f5e7c638d950aab3b55169b603121b57c85b`
- Integration branch: `integration/harborlight-phase4-mainline`
- Integration merge: `b6c5aaf35`
- Merge conflicts: none

The merge preserves the complete eleven-commit Phase 4 history and the
Harborlight-owned Sounding Line handoff. It does not import unmerged Sounding
Line source or alter that program's policy, planning, metadata, or control
plane.

## Preserved migration and operational scope

SQLite migrations: `20260729120000_harborlight_phase4_moderation_operations`
and `20260729121000_harborlight_phase4_relational_integrity`.

MySQL migrations: `0046_harborlight_phase4_moderation_operations` and
`0047_harborlight_phase4_relational_integrity`.

The integration retains durable moderation, actions, sanctions, appeals,
restoration receipts, fail-closed scanner receipts, database rate limiting,
outbox leases, workers, schedules, moderator interfaces, isolated browser
acceptance, logical backup, and isolated logical restore drills.

## Validation and pending evidence

The task-owned runtime `validation-20260729T151331004Z-73881c974a00`
installed the locked dependencies, generated the SQLite client, and applied all
48 SQLite migrations into a nonce-bound isolated copy without mutating the
canonical database. Focused Phase 4 Vitest validation passed 4 files and 9
tests. The authenticated `harborlight-phase4` browser project passed 2 tests,
including anonymous denial, moderator role resolution, queue and case detail,
keyboard focus, mobile, 200% zoom, reduced motion, serious/critical Axe, CSRF,
revision conflict, and conflict-of-interest denial; its owned port 3100 was
released afterward.

The wrapper's whole-repository typecheck was historically blocked by
pre-existing legacy Prisma client/schema drift already present on `origin/main`.
It is not a Harborlight regression and is not represented as a pass. No result
in this receipt represents live ClamAV, MinIO/S3, MySQL, external alert
delivery, or trusted Linux/systemd deployment evidence.
