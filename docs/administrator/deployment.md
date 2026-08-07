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

Correction Round 3 selects Resend for real transactional email and retains the
synthetic adapter only for task-owned validation. Deployment must inject the
server-only Resend variables and independently prove inbox delivery. Owner
Re-Review Round 3 remains `PENDING_OWNER_DECISION`; this branch is not deployed.
