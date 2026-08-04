---
title: Project Homeport Phase 7 Reset Stop and Rollback
audience: product-owner
status: current
canonical_for: project-homeport-phase-7-walkthrough-reset-stop-rollback
last_reviewed: 2026-08-04
---

# Reset, stop, and rollback

Engineering commands from the retained worktree are:

```powershell
npm run homeport:phase7:walkthrough:reset
npm run homeport:phase7:walkthrough:status
npm run homeport:phase7:walkthrough:stop
```

Reset stops only the owned runtime if necessary, recreates only the final task-owned walkthrough clone from the
immutable seed, and leaves the seed/canonical database untouched. Stop rejects an unowned PID or mismatched lease.

Rollback is a Git review action on the coherent Phase 7 implementation, harness, evidence, and documentation family;
there is no schema or migration rollback. Never delete or replace the canonical
`C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db`, the retained worktree, or unrelated task artifacts.
