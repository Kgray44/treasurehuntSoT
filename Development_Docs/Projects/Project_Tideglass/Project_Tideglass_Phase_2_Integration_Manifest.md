---
title: Project Tideglass Phase 2 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-2-integration
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 2 integration manifest

Status: candidate preparation. No integration claim is made until an exact candidate SHA receives Sounding Line `RELEASE_GO`, protected hosted checks pass, and the actual integrated main SHA is validated.

## Intended additive scope

- Phase 2 intelligence, summary, projection, annotation, cache, authorization, and safe API modules under `src/tideglass` and `src/app/api/chronicles`.
- One additive dual-provider annotation migration: SQLite `20260809130000_tideglass_phase2_creator_annotations`; MySQL `0053_tideglass_phase2_creator_annotations`.
- Governed Tideglass tests, validation/rehearsal/generator scripts, Sounding Line source policy, and generated active registry.
- Project engineering records and the owning Feature Catalog source fragment if final capability status satisfies catalog governance.

## Explicit exclusions

No ordinary `/tideglass` route, comparison page, navigation entry, Wakebook or Wayfarer played-history integration, Shipwright UI, Drydock implementation, Harborlight update decision, polished “What Changed” experience, admin diagnostic projection, Redis/distributed cache, live-Voyage mutation, or Phase 3 work is included.

## Reconciliation protocol

Immediately before candidate publication, fetch current `origin/main` and compare it with base `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`. Recheck migration IDs, Prisma relations, `src/tideglass`, Chronicle authorization/publishing, One Voyage, Drydock/Wakebook/Shipwright/Wayfarer/Harborlight, Sounding Line policy/generators, documentation indexes, and Feature Catalog sources. Preserve both accepted source fragments and regenerate shared outputs. Rerun every invalidated suite; do not resolve overlaps by discarding accepted mainline changes.

## Rollback and disable strategy

Application rollback removes API/service consumers and leaves immutable annotation revisions inert. The bounded process cache disappears naturally and rebuilds from immutable editions. The additive annotation table is not dropped by an automated down migration. Recovery, if required, is application rollback plus a verified matched backup; published snapshots, live sessions, personal history, and Community releases do not need repair.

## Publication record

Candidate SHA, pull request, hosted Mainline Decision, integration SHA, post-merge receipt set, and parity will be added only after they exist.
