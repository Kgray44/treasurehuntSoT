# Harborlight Phase 2 Cross-Project Integration Manifest

- Harborlight branch: `codex/project-harborlight-phase2-open-the-exchange`
- Base: `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`; current `origin/main` at preflight: the same SHA.
- Read-only concurrent heads observed: One Voyage `codex/project-one-voyage-phase2-close-the-old-passage` `b5cb242ca07502d85b3ce202b03a90a5dc8d58e0`; Wayfarer `codex/project-wayfarer-phase2-full-profile-preferences` `34996939961abe5e774cbdf722b4664fa3b0f0d0`; Sealed Hold `codex/project-sealed-hold-phase2-fortify-the-hold` `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`.

No concurrent branch was merged, rebased, copied from, or modified. Expected reconciliation points are Prisma schema/migration order; One Voyage Studio-source and draft APIs; Wayfarer public identity/capability projection; Sealed Hold safety/scanner/storage adapters; authorization/outbox registrations; and overlapping package/asset test fixtures. Harborlight's adapter interfaces in `src/community/ports.ts` are the required replacement points.

Recommended convergence order remains One Voyage, Wayfarer, Sealed Hold, Harborlight, then cross-project reconciliation. Re-run ordered migrations, Prisma generation, package security, install rollback, privacy, active-session invariance, and the full build after merge.
