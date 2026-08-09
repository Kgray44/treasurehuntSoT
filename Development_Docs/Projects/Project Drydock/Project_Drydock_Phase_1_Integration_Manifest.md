---
title: Project Drydock Phase 1 Integration Manifest
audience: engineering
status: current
canonical_for: project-drydock-phase-1-integration-manifest
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 integration manifest

## Owned additions

- `src/drydock/`: canonicalization, strict block contracts, parser/serializer, migrations, variables, expressions, provider/extension registries, stable issues, dependency index, and incremental validation.
- `scripts/drydock/`: deterministic artifact generator and privacy-safe domain CLI.
- `tests/fixtures/drydock/`: frozen synthetic schema-v1 fixture corpus covering all 23 current types.
- `Development_Docs/Projects/Project Drydock/`: human records and generated machine registries/ledgers.
- `testing/`: `unit.drydock` ownership, contract, policy, impact, release-gate, and generated case definitions.

## Narrow consumer adaptations

| Consumer               | Adaptation                                                                                                                        | Authority preserved                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Creator Studio service | exposes v2 Drydock registry/default configuration, presentation, completion, and contract metadata                                | Shipwright retains interaction/layout ownership                        |
| Tale editor            | writes completion mode to `completion`, creates stable IDs for new Set Variable blocks, and honors registry defaults              | no workspace redesign; autosave transport unchanged                    |
| Current validator      | schema-level issues come from Drydock; accepted answer/asset/provider/reference/reachability/completion/unused protections remain | existing validator remains the product aggregate                       |
| Publishing             | validates and canonicalizes blocks, then applies the explicit legacy runtime projection                                           | One Voyage publication transaction and progression semantics unchanged |
| Provider dispatch      | reads separated completion mode first, then legacy configuration aliases                                                          | One Voyage runtime provider behavior unchanged                         |

## Data and rollback

Prisma models changed: **0**. Prisma migrations: **0**. Backfills or mass draft rewrites: **0**. Existing immutable published snapshots are unchanged. Rollback is an ordinary code/documentation reversal; no database recovery is required.

Phase 2 analysis, issue workspace, repairs/waivers, Phase 3 simulation, and Phase 4 program closure are absent.
