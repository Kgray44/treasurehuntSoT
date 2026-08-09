---
title: Project Admiralty Phase 1 Owner Walkthrough
audience: product-owner-engineering-security
status: current
canonical_for: project-admiralty-phase-1-owner-walkthrough
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 owner walkthrough

Current state: `COMPLETED_OWNER_ACCEPTED`.

Owner decision: `ACCEPTED` on `2026-08-09`.

The owner completed every governed walkthrough step against source
`750b904cfec013f0b6adec3d930caf5eeae9ec0b`. The decision is recorded in
`../../Project_Admiralty_Phase_1_Owner_Decision_Record.md`. The isolated runtime
was stopped after acceptance; the commands below remain historical controller
instructions, not an invitation to reopen the accepted walkthrough.

The controller uses only a task-owned root below
`%LOCALAPPDATA%\ProjectAdmiralty`, a fresh synthetic SQLite database, an exact
production build, and a private external credential handoff. It refuses the
canonical repository database and unrelated port owners.

## Runtime commands

In PowerShell, from the retained Admiralty worktree:

```powershell
$env:ADMIRALTY_PHASE1_TASK_ROOT = "$env:LOCALAPPDATA\ProjectAdmiralty\phase1-owner-walkthrough-20260809"
npm run admiralty:walkthrough:prepare
npm run admiralty:walkthrough:start
npm run admiralty:walkthrough:status
```

Open `http://127.0.0.1:3792`. Account identifiers and the shared synthetic
password are in the private file reported as `credentialHandoffPath`; do not
copy its password into source, screenshots, chat, or this record.

Use `npm run admiralty:walkthrough:reset` for a fresh database and exact rebuild.
Use `npm run admiralty:walkthrough:stop` when the walkthrough is finished. The
controller records its PID, port, source SHA, build ID, database path and hash,
fixture version, logs, and pending owner decision in the task root.

## Walkthrough sequence

1. Sign in as `ORDINARY_USER`. Confirm ordinary navigation has no Admin entry
   and direct `/admin` produces the deliberate not-found result without an
   administrative payload.
2. Sign in as `ADMINISTRATOR`, enter `/admin`, and review the bounded operator,
   capability, environment, audit, and registry projections.
3. Attempt a sensitive action before reauthentication and confirm it is denied.
   Reauthenticate with the synthetic password and confirm recent assurance is
   visibly active and session-bound.
4. Request exact safe scopes for `SUPPORT_TARGET`, including a concise purpose.
5. Sign in as `SUPPORT_TARGET`, open **Account > Support Access**, review the
   operator, purpose, scopes, expiry, and excluded data, then approve.
6. Return as `ADMINISTRATOR`, reauthenticate if required, perform the scoped
   read, and confirm the projection and audit summary contain no credential,
   token, private prose, or private-media material.
7. Return as `SUPPORT_TARGET`, revoke the grant, then confirm the same support
   read is denied immediately.
8. Repeat with `DENIAL_TARGET` and deny the request; confirm no grant or read is
   possible.
9. Inspect desktop and narrow layouts, keyboard focus, and reduced-motion
   behavior. Record the owner decision separately from automated evidence.

## Decision boundary

Owner acceptance is established by the separate owner record. The package does
not by itself establish mainline integration, deployment, production MySQL
behavior, live-provider behavior, physical-device proof, or physical
assistive-technology validation. Phase 2 is not authorized by the Phase 1
decision.
