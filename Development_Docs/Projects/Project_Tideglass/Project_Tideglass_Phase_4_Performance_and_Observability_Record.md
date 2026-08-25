---
title: Project Tideglass Phase 4 Performance and Observability Record
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-performance-observability
---

# Project Tideglass Phase 4 Performance and Observability Record

## Execution and cache truth

The accepted provider is a bounded rebuildable in-process cache. No accepted
shared cache provider was present on the fresh Phase 4 mainline, so this phase
does not claim distributed-cache deployment. Canonical cache identity includes
Chronicle ID, both exact edition IDs and checksums, semantic schema version, and
comparison policy version; it contains no account, history, Memory, Keepsake,
or participant data.

Phase 4 adds explicit corrupt-entry handling. A digest-invalid entry is evicted,
the immutable pair is recomputed, and the operational envelope reports
`CORRUPT_REBUILT`. The diagnostic projection carries only safe timing, cache,
policy, identity, category-count, and bounded failure/unsupported-section data.

`tests/tideglass/cross-process-worker.ts` runs canonicalization and comparison
in a fresh Node process. The determinism test executes that worker twice over
the same encoded synthetic pair and proves equal deterministic digest and stable
change-record IDs. This proves result correctness without pretending a shared
cache has been deployed.

## Current measured evidence

The inherited synthetic large-graph tests exercise 500 Story Blocks, map-based
identity matching, 2,000 annotation records, cold comparison, and warm cache
read. They retain the current repository's generous development bound of under
five seconds; they are not yet a final production performance certification.

Ordinary API logging already records comparison ID, exact edition identity,
checksums, policy versions, category counts, cache status, timing, and a safe
correlation ID. It must not log authored snapshot text, accepted answers,
Creator annotation text, private media URLs, credentials, or private history.

## Remaining qualification

Final p50/p95 runs, long-retained-history measurements, multi-process proof,
and operational-browser evidence remain pending. Observability must stay
non-authoritative: its failure cannot alter comparison correctness.
