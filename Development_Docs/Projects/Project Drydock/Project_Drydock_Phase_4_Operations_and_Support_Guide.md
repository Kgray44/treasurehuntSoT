---
title: Project Drydock Phase 4 Operations and Support Guide
audience: support engineering
status: development-current
canonical_for: project-drydock-phase-4-operations
last_reviewed: 2026-08-13
---

# Project Drydock Phase 4 operations and support guide

Use owner-safe API projections and immutable receipt digests only. Do not retrieve accepted answers, authored prose, Creator notes, raw provider payloads, storage keys, private locations, or session data to diagnose a Drydock decision.

| Signal | Safe interpretation | First response |
| --- | --- | --- |
| `CHECKING` | server decision is not yet available | wait/reload; never enable publication from a cached client state |
| `NEEDS_REPAIR` | static, compatibility, or mandatory evidence is missing/current-source-invalid | use safe issue codes and requirement IDs; repair or refresh evidence |
| `TRIALS_INCOMPLETE` | a required Suite has no passed current-policy receipt | create/run the required source-bound Suite; do not reuse stale runs |
| `READY_WITH_WARNINGS` | only governed warnings/waivers remain | review waiver expiry, revocation, and source checksum before approval |
| `VERIFIED` | exact source is eligible for the One Voyage transaction | request publication once; this is not a published-version claim |
| `PUBLICATION_PENDING` / `PUBLICATION_FAILED` | transaction not proven committed | preserve current evidence only while fresh; inspect the safe error code; do not play success |
| `PUBLISHED` | version and immutable evidence are bound | retrieve evidence through the owner-safe version evidence route |

## Evidence, compatibility, and historical failures

- Inspect publishing evidence only through `GET /api/studio/tales/:taleId/versions/:versionId/evidence`; its checksum and digest must agree with the published version.
- A stale report, Scenario receipt, waiver, compatibility run, or external reference is not repairable by relabeling it. Regenerate against the current source.
- Historical reader failures are intentionally bounded errors. Do not deserialize around size/depth/array/prototype guards; preserve the raw immutable snapshot and follow the migration-preview path, which creates a new draft only.
- For waived warnings, inspect the safe waiver receipt, its rule version, expiry, revocation state, source checksum, and audit reference. Errors, security/privacy findings, and nonwaivable rules remain blocked.
- For provider evidence, confirm the provider ID, provider version, evidence kind, safe status, freshness, and adapter state. Contract-only/unavailable adapters require owner evidence when the authored source uses them.

## Publication and incident diagnosis

1. Confirm the requested version is immutable and the Drydock source checksum matches it.
2. Confirm a single `DrydockPublishingEvidence` receipt is attached. A same-source uniqueness race returns that existing bound version and emits no second catalog event.
3. For a failed Community package preflight, confirm the Community release points to an immutable version with matching Drydock evidence before inspecting package scan or license facts.
4. For a stalled Sea Trial worker, reclaim only `RUNNING` leases that are expired and nonterminal. Completed/cancelled receipts are not requeued.

## Privacy-safe metrics

Approved aggregate categories are validation-run count, Scenario Suite-evidence count, compatibility result status, stale external-evidence count, waiver count by rule code, historical-reader safe failure count, and adapter availability. These measures must be aggregated without Chronicle titles, block text, answers, Creator identifiers, private locations, raw evidence, or session data. Metrics that are not durably recorded (for example readiness-state or publication-failure history) must be reported as unavailable rather than inferred.
