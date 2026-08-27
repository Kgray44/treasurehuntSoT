---
title: Project Helm Amendment A2 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a2-integration-manifest
last_reviewed: 2026-08-27
---

# Project Helm Amendment A2 integration manifest

## Additive persistence

- SQLite: `20260826110000_helm_a2_authority_lifecycle`
- MySQL: `0062_helm_a2_authority_lifecycle`
- `TaleSession.captainAuthorityState`
- `VoyageCaptainAuthorityReceipt`
- `VoyageForkLineage`

## Runtime and surfaces

- `src/helm/authority-lifecycle.ts`: scoped transfer, relinquishment, takeover, continuation, receipts, lineage, and idempotency.
- `src/chronicle/progression.ts`: rejects shared progression and verification completion during Succession Hold.
- `src/platform/libraries.ts`: Player-safe Succession Hold, authority, and continuation projection.
- Captain and Player routes/components: explicit direct transfer, relinquishment, takeover, solo fork, and canonical leave choices.
- `src/helm/authority-command.client.ts`: replays one lost/timeout browser response with the unchanged idempotency key, allowing the server to return the durable authority receipt without a duplicate mutation.

## Validation entry points

- `npm run helm:a2:migrations`
- `npm run helm:a2:journeys` (fresh task-owned SQLite plus optimized `next build` / `next start` Chromium journey)
- `npx playwright test tests/e2e/project-helm-phase1.spec.ts --project chromium` after the standard Sounding Line build, SQLite bootstrap, and seed; the default fixture starts the built application with `next start`.
- `src/helm/authority-lifecycle.test.ts`
- `src/components/platform/PlayerLibrary.test.tsx`
- `src/components/platform/PlayerVoyageRoom.test.tsx`

## Excluded scope

No A3 readiness/preflight, original Phase 3 command redesign, new progression store, membership duplication, creator/private-data copy, or Wakebook P3 work is present.
