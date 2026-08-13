---
title: Project Admiralty Phase 2 Owner Walkthrough
audience: product-owner-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-owner-walkthrough
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 owner walkthrough

## Runtime

The retained runtime uses a task-owned production build, synthetic SQLite
database, private credential handoff, and reserved local port. It refuses the
canonical database and refuses to start when the prepared source differs from
the current branch source.

```powershell
$env:ADMIRALTY_PHASE2_TASK_ROOT = "$env:LOCALAPPDATA\ProjectAdmiralty\phase2-owner-walkthrough"
npm run admiralty:walkthrough:prepare
npm run admiralty:walkthrough:start
npm run admiralty:walkthrough:status
```

Use `npm run admiralty:walkthrough:reset` to restore the synthetic scenario and
`npm run admiralty:walkthrough:stop` when the walkthrough is complete. The
private handoff supplies Full Administrator, Support Operator, Operations
Observer, Audit Operator, Ordinary User, and Support Target User identities.
Passwords, cookies, and database contents are never committed.

## Checklist

1. Confirm the Ordinary User has no Admiralty menu entry and direct `/admin`
   access reveals no privileged state.
2. As Full Administrator, enter Admiralty naturally from the account menu and
   inspect Overview, People, Chronicles, Voyages, Community, Operations,
   Providers, Configuration, Releases, Audit, and Investigate.
3. Search for the Support Target without an account ID. Review the dossier and
   confirm technical identifiers remain secondary.
4. Reauthenticate, request exact support scopes, approve as the target, inspect
   only the approved projection, revoke, and confirm access immediately closes.
5. Verify Support Operator, Operations Observer, and Audit Operator navigation
   and direct-route partitions.
6. Follow Chronicle/edition/Voyage relationships, safe Voyage events,
   Community releases/moderation state, jobs/providers, and a correlation ID.
7. Confirm unavailable and missing-contract states are understandable and no
   raw JSON, database dump, secret, private content, or fake mutation dominates
   the experience.
8. Review desktop and narrow layouts, keyboard focus, reduced motion, and
   effective 200-percent zoom.

Record `ACCEPTED` or exact required corrections separately. A running local
walkthrough is not deployment, mainline integration, or acceptance.
