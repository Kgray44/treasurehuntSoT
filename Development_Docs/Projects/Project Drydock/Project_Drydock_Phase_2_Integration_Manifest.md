---
title: Project Drydock Phase 2 Integration Manifest
audience: engineering
status: current
canonical_for: project-drydock-phase-2-integration-manifest
last_reviewed: 2026-08-10
---

# Project Drydock Phase 2 integration manifest

## Owned additions

- `src/drydock/`: whole-Chronicle graph, state, variable, asset, accessibility, provider, side-effect, report, repair, and waiver analysis.
- `scripts/drydock/`: deterministic static-analysis validation and generated catalog artifacts.
- `tests/fixtures/drydock/` and `src/drydock/mutation-corpus.test.ts`: privacy-safe synthetic corpus and 31 controlled static-analysis scenarios.
- Prisma migrations for additive validation reports and rule waivers in SQLite and MySQL.

## Preserved authority boundaries

Creator Studio interaction and layout remain Shipwright-owned. Chronicle progression, publication, and live session behavior remain One Voyage-owned. Drydock supplies static analysis only: it does not start Phase 3, create a simulator, or mutate a live Tale Session.

## Accepted integration

Protected PR #36 integrated candidate `190e31c862c1a504acdf0da01e32efd677b69449` as mainline merge `847e035775984888be71edf614f2205fd6c5a376`. The protected Sounding Line mainline source `5b70fbd4cf92f4b7b0b9b4753ef498ae699a3d01` returned `RELEASE_GO` with 37 / 37 selected receipts passed and clean. Evidence digest: `7a0b3ca525273deb3dbd931318fbd400e1310807b0dd3eb7c4e173ad96e428e0`.

The separately required hosted final-closure workflow passed for the exact candidate. Post-merge `drydock:validate` passed on the integrated mainline SHA. Rollback is a protected code-and-migration reversal; no backfill or mass rewrite was performed by this acceptance.
