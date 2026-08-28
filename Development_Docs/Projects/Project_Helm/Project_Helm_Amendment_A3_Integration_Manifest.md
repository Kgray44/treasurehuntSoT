---
title: Project Helm Amendment A3 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a3-integration-manifest
last_reviewed: 2026-08-27
---

# Project Helm Amendment A3 integration manifest

## Persistence

There is no A3 schema change, migration, backfill, or data rewrite. Existing
`TaleSession`, memberships, invitations, presence devices, and A2 authority
receipts remain authoritative.

## Runtime and surfaces

- `src/components/captain/CaptainMusterRoom.tsx` and
  `/captain/voyages/[playthroughId]/muster` provide the scoped Captain-only and
  Captain + Player muster view.
- `src/components/platform/PlayerVoyageRoom.tsx` provides the ordinary Player
  and participating-Captain waiting-room projection, reconciliation, and
  direct launch affordance.
- `src/platform/libraries.ts` and `src/helm/operations.ts` extend existing
  safe projections with membership, invitation, presence, readiness, and
  Captain markers; they create no lifecycle authority.
- `src/chronicle/progression.ts` preserves the ready-Crew gate whenever a
  membership exists while allowing a true zero-membership Captain-only Voyage
  to launch.
- `src/components/platform/CaptainLibrary.tsx` links each owned Voyage to its
  Muster Room without replacing the Captain Console.

## Validation entry points

- `vitest run src/chronicle/progression.test.ts src/components/platform/PlayerVoyageRoom.test.tsx src/components/captain/CaptainMusterRoom.test.tsx src/helm/operations.test.ts src/platform/invitations.helm.test.ts src/helm/lifecycle.test.ts src/helm/authority-lifecycle.test.ts src/components/platform/CaptainLibrary.helm.test.tsx`
- `next build`, then `playwright test tests/e2e/project-helm-phase1.spec.ts --project chromium --grep "Ready the Room keeps"` with a task-owned SQLite database and built `next start` server.
- `npm run docs:validate`, `npm run features:sync`, `npm run features:validate`, and ordinary candidate-bound Sounding Line.

## Excluded scope

No Figurehead/avatar system, original Helm P3 command redesign, new command
authority, new progression stream, membership duplication, private-state
exposure, deployment, or owner acceptance is included.
