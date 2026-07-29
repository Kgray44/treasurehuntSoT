---
title: Project Sounding Line Phase 3 Preparation Design Record
audience: engineering
status: current
---

# Project Sounding Line Phase 3 Preparation: Read the Current

**Status:** PREPARATION_COMPLETE_CANDIDATE — IMPLEMENTATION_NOT_STARTED
**Base:** `3d26ebc697a89efd7ff19d28399f3d41e32e423e` (Phase 1–2 integration head)
**Boundary:** PREPARATORY / NONAUTHORITATIVE / SYNTHETIC INPUT ONLY / NOT CONNECTED TO ACTIVE RUNTIME

## Scope and frozen meanings

This package defines the future historical store, impact and risk model, evidence freshness, root/cascade normalization, rerun eligibility, failure and flake signatures, stale and slow-suite governance, duration-aware sharding, throttling, durable execution, diagnostics, and Codex completion-report contract. It does not activate any of them. `npm run validate`, the Phase 2 runtime, broker, resource leases, receipts, cleanup, CI, release decisions, and package scripts are unchanged.

Canonical IDs are lower-case, namespaced strings: `sl3-run-*`, `sl3-plan-*`, `suite:<id>`, `case:<suite>:<id>`, and SHA-256 digests over canonical JSON. A historical store is owned by Sounding Line, not product Prisma. Evidence is fresh only when its source, policy, suite, executor, fixture, environment, browser/provider/database baseline, dependency/build, and cleanup identities prove compatibility. Unknown identity always invalidates or broadens; it never narrows.

Impact edges are `DIRECT_SOURCE`, `IMPORT_DEPENDENCY`, `CONTRACT_PRODUCER`, `CONTRACT_CONSUMER`, `SCHEMA`, `MIGRATION`, `SERIALIZATION`, `ROUTE`, `AUTHORIZATION`, `PRIVACY`, `SECURITY`, `COMPATIBILITY`, `FIXTURE`, `RUNTIME_INFRASTRUCTURE`, `PACKAGE_DEPENDENCY`, `RELEASE_GATE`, `UNKNOWN_OWNERSHIP`, and `UNKNOWN_DEPENDENCY`. Confidence is `AUTHORITATIVE`, `STATIC_ANALYSIS_HIGH_CONFIDENCE`, `DECLARED_POLICY`, `HEURISTIC_CONSERVATIVE`, or `UNKNOWN`; only the first three can ever support omission, and even then only with an explainable freshness result.

Risk is `LOW`, `MODERATE`, `HIGH`, `CRITICAL`, or `RELEASE_CRITICAL`. High-risk domains include authentication, authorization, privacy, secret handling, migration, irreversible mutation, public projection, recovery, accessibility, browser compatibility, build/deployment, and external systems. Critical unknown impact forces all-relevant selection. Full explicit release gates remain comprehensive and cannot be satisfied by reused or narrowed evidence.

Failure normalization has one terminal outcome per planned node: `PASSED`, `PASSED_AFTER_RETRY`, `FAILED_ROOT`, `CASCADE_BLOCKED`, `SKIPPED_POLICY`, `CANCELLED`, or `NOT_RUN`. A cascade requires a proven failed dependency; temporal order alone is insufficient. Reruns invalidate repaired roots, their dependency descendants, changed tests, changed fixtures, and affected infrastructure; unrelated fresh evidence may remain only with proof. Retry passes remain visible. No test becomes a qualified flake from one retry pass.

Duration estimates retain outliers, separate cold/warm, browser/resource/fixture profiles, and use median, p75/p90/p95, MAD, and EWMA with explicit minimum samples. Deterministic shards use stable ordering and conservative fallbacks. Throttling uses CPU, memory, disk, worker, build, interactive-reserve, queue-age, and cleanup-backlog signals; it may stop launches and prioritize cleanup but never weakens required evidence.

## Phase 2 handoff state

The focused survey found sealed-plan validation, graph validation/scheduling, local run markers, resource leases, SQLite/browser/service isolation, receipts, cleanup, and compatibility reporting. These are **PROVISIONAL_RECONCILE_AFTER_PHASE2**, not Phase 3 inputs yet: the Phase 2 record still says product adapters, cross-run PID reuse, shared-harness lock narrowing, external-provider evidence, and release validation are not validated. Historical timing fields, stable suite/test receipts, authoritative cleanup receipt schema, controller/client journals, and provider/environment fingerprints are **MISSING_REQUIRED_PHASE3_INPUT**. Existing policy/source digests and graph suite IDs are **STABLE_PHASE3_INPUT** in concept, subject to final schema reconciliation.

## Start and rollback gates

## Post-Phase-2 reconciliation addendum

Accepted mainline is `ee5cffd457708559041cfc3331eb315906812e15`; its policy is `1.1.0` with 14 suites, 17 contracts, 19 resources, and zero critical inventory unknowns. Stable inputs are canonical source/policy/plan digests; graph ordering; run marker/controller token; lease revision/state; conjunctive process identity; SQLite baseline/clone; service/browser/context/lane identity; allowlisted array adapters; bounded logs; cleanup/quarantine receipts; focused lane leases; emergency serial compatibility; and the global full-release lock.

Phase 3 adds without reinterpreting Phase 2: normalized historical run/node/attempt records, test-case identity, durable timing history, evidence artifact references, failure signatures, freshness/invalidation decisions, controller/client journals, resume tokens, and usage-report metadata. Missing Phase 2 timing or identity fields ingest as `UNKNOWN`, never zero. Version-1 Phase 2 receipts stay stable inputs; Phase 3 uses versioned additive ingestion records.

Real implementation requires accepted Phase 2 in mainline, Harborlight reconciliation, stable receipt schemas and adapters, authoritative cleanup, no critical isolation defect, reconciliation of these drafts to final interfaces, and a superseding implementation design record. Rollback of this preparation package is removal of only its documentation and isolated prototypes; no runtime, database, package, CI, or release state is involved.
