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

Final integrated command evidence, canonical main publication, cleanup state,
and final worktree inventory are recorded after the integration validation and
mainline push. No result in this receipt represents live ClamAV, MinIO/S3,
MySQL, external alert delivery, or trusted Linux/systemd deployment evidence.
