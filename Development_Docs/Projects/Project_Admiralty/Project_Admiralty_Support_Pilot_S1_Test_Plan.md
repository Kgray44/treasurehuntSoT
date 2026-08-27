---
title: Project Admiralty Support Pilot S1 Test Plan
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s1-test-plan
last_reviewed: 2026-08-27
---

# Support Pilot S1 Test Plan

## Synthetic-only rule

All S1 acceptance uses task-owned synthetic accounts, cases, grants, sessions,
and evidence. No real account data, private Chronicle content, media, or
credentials may be inspected for acceptance.

## Required proof

- An exact approved case/grant yields a short-lived `READ_ONLY` execution capability.
- Expired, revoked, missing-consent, foreign-operator, foreign-target, and
  foreign-case grants fail closed.
- Unapproved diagnostic domains are denied.
- Private content, credentials, secrets, and raw logs are not grantable.
- Source-bound receipt generation is deterministic and output is sanitized.
- A proposal is information only and has no command executor.
- The support-case screen explains consent, expiry/revocation, diagnostics,
  provenance, diagnosis, and the no-repair boundary accessibly at responsive
  widths.

## Focused commands

```powershell
npm exec vitest run src/admiralty/support-pilot.test.ts src/admiralty/support-access.test.ts src/components/admiralty/SupportCaseConsole.test.tsx
npm exec prisma validate --schema prisma/schema.sqlite.prisma
npm exec prisma validate --schema prisma/schema.prisma
```

The candidate must additionally pass the ordinary candidate-bound Sounding Line
and a landed synthetic support-case smoke before S1 closure can be claimed.
