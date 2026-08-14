---
title: Project Drydock Phase 4 Test Plan
audience: engineering
status: v1.4-reconciled-qualification
canonical_for: project-drydock-phase-4-test-plan
last_reviewed: 2026-08-14
---

# Project Drydock Phase 4 Test Plan

This plan separates local qualification from protected-main acceptance. Sounding Line remains the sole release authority.

## Reconciled local evidence

- `drydock:test`: all Drydock readiness, evidence, compatibility, persistence, performance, recovery, privacy, and contract checks.
- `drydock:readiness`, `drydock:publishing-contract`, `drydock:historical`, `drydock:sea-trials`, and `drydock:harborlight`: focused contract-family rebounds.
- `drydock:phase4:migrations:sqlite`: task-owned SQLite rehearsal through all Phase 4 migrations with representative Phase 3 Suite data. MySQL is static SQL parity only.
- `drydock:validate` and `test:policy`: generated authoring/rule artifacts, fixture compatibility, migration metadata, and v1.4 policy registration.
- `drydock:browser`: authenticated task-owned Chromium journey with a fresh SQLite database, visible Studio navigation, source-bound Launch Gate and Compatibility, Sea Trials, 390 px viewport, keyboard focus, and Axe serious/critical assertions.
- `docs:validate`, `features:validate`, `lint`, and `test:raw:build`: current documentation, catalog, static lint, and non-authoritative production-build proof.

## Candidate qualification sequence

1. Regenerate source-owned catalog, document-index, and Sounding Line test-registry outputs.
2. Freeze one exact branch head and rerun the impacted project evidence against that source identity.
3. Record the candidate SHA, remote parity, and preserved v1.4 rebound evidence.
4. Do not dispatch Sounding Line Mainline Decision or merge until the independent v1.4 post-cutover browser-fixture closure is green.

## External boundaries

Live MySQL and connected provider proof are distinct from the isolated SQLite and contract-adapter evidence. They remain explicitly unpassed until an isolated policy-approved service or provider proof is available.
