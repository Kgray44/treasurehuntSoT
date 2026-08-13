---
title: Project Drydock Phase 4 Design Record
audience: engineering
status: active
canonical_for: project-drydock-phase-4-design
last_reviewed: 2026-08-13
---

# Project Drydock Phase 4: Clear for Launch

## Authority and base

Phase 4 begins on freshly verified `origin/main` `60b89841986e66fbc2c0828489d38002a1617506` in the owned branch `codex/project-drydock-phase4-clear-for-launch`. Phase 1 contracts, Phase 2 static receipts and governed waivers, and Phase 3 deterministic Scenario evidence remain the only sources of their respective facts. One Voyage remains the sole publication and runtime authority; Shipwright remains the Studio interaction owner.

## One readiness contract

`DrydockReadinessDecision` is the sole source-bound decision consumed by Studio, APIs, CLI, CI, and the One Voyage publication boundary. Its states are `CHECKING`, `NEEDS_REPAIR`, `TRIALS_INCOMPLETE`, `READY_WITH_WARNINGS`, `VERIFIED`, `PUBLICATION_PENDING`, `PUBLISHED`, and `PUBLICATION_FAILED`. Every non-terminal decision binds the exact canonical source checksum. A decision is not a publication claim; only a successful One Voyage transaction may yield `PUBLISHED`.

The evaluator takes a complete static report, capability-derived evidence requirements, required Suite freshness, compatibility result, external-evidence summaries, and source-bound waiver snapshots. It fails closed for stale reports, runs, compatibility, waivers, external evidence, source revisions, unsupported contracts, and nonwaivable issues. It returns safe issue references and direct next-action information rather than authored source or private Scenario data.

## Publishing boundary

One Voyage freezes the Studio source, recomputes its checksum, asks Drydock for a `VERIFIED` decision for that exact source, creates the immutable `PublishedTaleVersion`, and persists `DrydockPublishingEvidence` in the same transaction. A mismatch, duplicate request, persistence error, or transaction failure produces no published claim and no success signal. Old evidence remains immutable and inspectable only through owner-safe projections.

## Compatibility and adapters

Compatibility consumes versioned authoring, block, expression, variable, Scenario, report, evidence, provider, dependency, and asset facts. It returns one of `COMPATIBLE`, `COMPATIBLE_WITH_UPCAST`, `COMPATIBLE_WITH_WARNINGS`, `MIGRATION_AVAILABLE`, `EXTERNAL_REQUIREMENT_PENDING`, `UNSUPPORTED`, or `CORRUPT_OR_INVALID`. Historical reads remain in-memory transformations; migration preview creates a new draft only after explicit Creator action.

Adjacent projects contribute versioned adapters. Harborlight owns Community package, license, attribution, and install semantics; Sealed Hold owns scanner and quarantine truth; Lanternwake owns presentation truth; Landfall and artifact providers own real-world/provider facts. Drydock consumes safe summaries and never turns simulation into real-world proof.

## Persistence and privacy

Phase 4 adds only immutable publishing evidence, bounded compatibility-run data, and external-evidence references when existing Phase 2/3 records do not already provide the needed identity. Records are owner-scoped, checksum-bound, indexed by published version, and never store authored prose, accepted answers, private Scenario inputs, Captain notes, raw provider evidence, storage keys, or private locations. SQLite and MySQL migrations are additive and must remain in parity.

## Release and rollback

The final implementation is additive. Rolling back application paths leaves immutable published versions, existing Drydock reports, Scenario evidence, and additive Phase 4 records inert; it never mass-rewrites published snapshots, live sessions, Harborlight data, or provider records. Qualification and protected acceptance occur only after the complete current source is frozen.
