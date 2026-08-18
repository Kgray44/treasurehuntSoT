---
title: Project Drydock Phase 4 Reconciliation Record
audience: engineering
status: v1.4-mainline-reconciled
canonical_for: project-drydock-phase-4-reconciliation
last_reviewed: 2026-08-18
---

# Project Drydock Phase 4 reconciliation record

The implementation began from accepted `origin/main` `60b89841986e66fbc2c0828489d38002a1617506`. Resumption fetched protected `origin/main` `268932d630ee0ea1721d0072da4041f7209b7464` (Sounding Line v1.4 hosted-wave-capacity merge).

The resumed branch merged that protected-main state without rebasing or rewriting the preserved checkpoint in `5aea6eb6de79dfe969aba68d26edfa870b01e2ab`. The only semantic overlap was `src/components/studio/TaleEditor.tsx`; the merge retains both the accepted v1.4 validation-field focus deferral and Drydock's Launch Gate/Compatibility integration. Feature Catalog, document index, and active test-registry artifacts were regenerated in `6662de34b128c2ef1136db5c10f3eeba1adccb31`.

The intervening Sounding Line paths are testing infrastructure and authority policy. They require v1.4 evidence rebound and final candidate qualification, but do not supersede the Phase 4 readiness, publishing-evidence, compatibility, migration, or Studio contracts. Current main introduced no Prisma or package-lock change, and no current Drydock implementation was discarded.

No synthetic merge, protected-main claim, authoritative Mainline Decision, or protected merge has been made. The resulting candidate remains held until the independent Sounding Line v1.4 post-cutover browser-fixture closure is confirmed green.

## Current protected-main rebound

Protected main subsequently advanced through the active v1.4.1 maintenance and mainline-train work to `8c7c3589955f94fcc8a400a81e4f61565d0d4521`. Phase 4 has not been accepted or superseded: its code, migrations, browser harness, and project records are branch-only additions, rather than paths removed by main. The branch merged that protected state in `3f387af0f8a599707a5a464a0c3215b7a21e31c6`, retaining Phase 4 while adopting the current shared authority, package, schema-adjacent, and generated-record contracts.

The current v1.4 registry requires durable `semanticId` values. The pre-v1.4.1 Phase 4 registry rows were reconciled by exact generated-ID matching only; an unmatched legacy row now fails closed. This repair is covered by the focused maintenance-identity test and current policy validation. No authoritative decision or protected merge has yet been requested.
