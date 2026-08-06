---
title: Deployment
audience: operator
status: current
canonical_for: deployment-runbook
last_reviewed: 2026-08-05
---

# Deployment

## Safety boundary

Deploy only reviewed, tested revisions to an authorized environment. Do not use real private content to prove a deployment.

## Procedure

1. Confirm the target environment, backup state, configuration, and migration plan.
2. Build the application and run the applicable validation gates.
3. Apply reviewed migrations through the approved deployment path.
4. Deploy the application, verify synthetic role access, and record the release evidence.

If verification fails, stop rollout and use the approved rollback or recovery path. See [backup and recovery](backup-and-recovery.md) and [upgrading](upgrading.md).

## Phase 7 correction Round 3 status

Correction Round 3 is locally exact-source validated and ready for owner re-review. It adds governed Profile imagery/cropping and identity propagation, six-digit verification, a Postmark production adapter with task-owned synthetic isolation, ordinary Player/Captain/Creator entry separated from resource authority, direct route crossfades, visible account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed. Postmark is `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`, broad Light Mode visual completion is deferred, and production MySQL plus physical assistive-technology validation remain external.
