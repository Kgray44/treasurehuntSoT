---
title: Project Helm Amendment A3 Test Plan
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a3-test-plan
last_reviewed: 2026-08-27
---

# Project Helm Amendment A3 test plan

## Acceptance journeys

| ID   | Journey                  | Required result                                                                                                                                                                           |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3-1 | Captain-only muster      | No Player seat is fabricated; the room says Captain-only, distinguishes leaving the room from leaving a Voyage, and direct launch uses the canonical launch route.                        |
| A3-2 | Participating Captain    | The Captain remains visibly an ordinary Crew member, never sees "Awaiting Captain," and receives the direct in-room launch control only when the existing Crew readiness rule permits it. |
| A3-3 | Crew state and lifecycle | Invited, joined/ready, online/offline, reconnecting, departed, removed, cancelled, and Captain-transfer changes have safe card and live-reconciliation treatment.                         |
| A3-4 | Existing commands        | Invitation, removal, leave, cancellation, transfer, relinquishment, takeover, and solo-continuation controls remain bounded by their existing canonical services.                         |
| A3-5 | Audience boundary        | Captain-only, Captain + Player, invited Player, joined Player, former Crew, and unrelated users receive only their permitted projection and actions.                                      |
| A3-6 | Presentation recovery    | Phone/narrow layout, 200 percent effective zoom, keyboard operation, reduced motion, live refresh, and serious/critical accessibility checks pass against a built server.                 |

## Required evidence

- Focused service, lifecycle, invitation, presence, Captain Library, and room
  component tests.
- A production-style Chromium journey against a fresh task-owned SQLite
  database after `next build` and `next start`; no development HMR server or
  canonical database is allowed.
- Format, changed-source lint, TypeScript assessment, documentation validation,
  Feature Catalog validation, private-content scan, and one candidate-bound
  ordinary Sounding Line/Mainline Decision before protected integration.

## Non-goals

No test uses a private Voyage, canonical account, live provider, production
database, physical assistive technology, Figurehead implementation, original
Helm P3 command redesign, or Wakebook P3 work.
