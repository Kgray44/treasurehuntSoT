---
title: Project Drydock Phase 4 Mainline Safety Contract
audience: engineering
status: active
canonical_for: project-drydock-phase-4-mainline-safety
last_reviewed: 2026-08-13
---

# Project Drydock Phase 4 Mainline Safety Contract

## Preserved authorities

- Phase 1 authoring contracts, Phase 2 static analysis, and Phase 3 simulation remain canonical.
- One Voyage alone creates immutable published Chronicle versions and controls live progression.
- Harborlight, Sealed Hold, Lanternwake, Landfall, artifact, and provider owners retain their domain semantics.
- Studio remains usable before verification; a readiness decision never rewrites Creator content.

## Fail-closed invariants

- Studio, API, CLI, CI, import, and publication invoke the same readiness evaluator.
- The source checksum, autosave revision, report, required Scenario results, compatibility result, waiver snapshots, and external evidence must all match the frozen source.
- `VERIFIED` is not `PUBLISHED`; success presentation occurs only after the One Voyage transaction and evidence attachment commit.
- Publishing evidence is immutable, belongs to exactly one published version, and is never reused for another Chronicle or draft revision.
- Security, privacy, corruption, unsupported mandatory contract, runtime mismatch, and missing mandatory authority are nonwaivable.
- External simulation is labeled synthetic and cannot satisfy a required real-world evidence requirement.

## Rollback

Application rollback disables Phase 4 paths while retaining additive rows inert. It does not mutate or orphan published versions, historical snapshots, Phase 1-3 evidence, live sessions, Community records, or protected assets. No destructive rollback migration is authorized.

## Permanent-stop condition

After protected Phase 4 acceptance, the application remains coherent if no later Drydock phase is ever created. No Phase 5 is required for the launch-readiness, evidence, compatibility, Studio, CLI, or CI contracts delivered here.
