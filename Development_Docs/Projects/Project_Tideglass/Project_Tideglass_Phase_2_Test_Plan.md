---
title: Project Tideglass Phase 2 Test Plan
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-2-test-plan
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 2 test plan

## Scope and authority

The `unit.tideglass` Sounding Line family is the primary Phase 2 contract suite. Generic static, SQLite, MySQL-declaration, build, cross-project, documentation, and Feature Catalog families are selected by the governed impact map. Raw Vitest, Prisma, or build commands are diagnostics; only source-bound Sounding Line decisions establish candidate or integrated-main readiness.

No browser journey is added because Phase 2 deliberately adds no ordinary route or polished UI. API route invocation tests cover request/auth/projection seams without treating a synthetic session as deployed or owner-acceptance proof.

## Required contract matrix

| Area                 | Required positive evidence                                                                                                         | Required negative evidence                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 preservation | exact-pair comparison, semantic determinism, checksum binding, partial/no-change behavior                                          | missing/unauthorized/cross-Chronicle/invalid/oversized snapshots                                                                                  |
| Classification       | every supported record has a stable code, category/kind, summary family, non-lowering significance; accessibility regression floor | no successful `TG-UNKNOWN`; unsupported semantics remain unsupported                                                                              |
| Significance         | evidence-linked reasons, category contributions, deterministic transformative escalation                                           | no opaque score or percentage-different authority                                                                                                 |
| Compatibility        | platform/provider/Captain/crew/accessibility/asset evidence with exact Change IDs                                                  | no independent provider/readiness certification                                                                                                   |
| Projection           | public visible-only counts, Player `DISCLOSABLE`, Creator-full diagnostics, deterministic digest                                   | no client escalation, hidden IDs/counts, answer/note/path/session leakage                                                                         |
| Summary              | stable line IDs/templates/order/digest and exact Change IDs/codes                                                                  | no unsupported statement, locale ordering, network/LLM dependency, or empty unexplained no-change result                                          |
| Annotation           | create/correct/withdraw immutable revisions, idempotency, exact-pair/Change binding, active revision projection                    | foreign author, stale revision, IDOR, mass assignment, lowered spoiler, cross-Chronicle, HTML/script/path/control/oversized input                 |
| Warnings             | deterministic significance/gameplay/accessibility/major-omission warnings                                                          | warnings never rewrite or suppress Creator or machine truth                                                                                       |
| Cache                | exact identity/version keys, hit/miss, bounded eviction, digest validation, corrupt rebuild                                        | no Player/history/participant/draft/live-Voyage context                                                                                           |
| API                  | edition list, comparison projection, explicit annotation DTO history/mutation, projection preview                                  | generic unavailable errors, invented playability/recommendation, CSRF denial, distinct rate limits, bounded strict JSON, no raw snapshot endpoint |
| Persistence          | provider schema parity, additive DDL, monotonic/unique revision constraints, zero annotation backfill                              | no destructive DDL, guessed notes, cache/history/session persistence                                                                              |
| Invariance           | comparison/projection leaves publication, Chronicle, live Voyage, Wayfarer history, and Harborlight rows unchanged                 | annotation mutation may touch only Tideglass annotation and audit rows                                                                            |

## Migration rehearsal

The SQLite rehearsal creates a task-owned temporary database, applies accepted migrations through the pre-Phase-2 state, inserts a synthetic account/Chronicle/published edition, fingerprints every non-audit/non-Tideglass business table, applies the Phase 2 migration, and verifies the fingerprint, empty annotation table, and foreign-key check. It then writes one synthetic annotation and one audit event and proves every other table remains equivalent by fingerprint. MySQL evidence requires schema/client validation plus execution against a disposable MySQL 8 schema when that provider is available; lack of a provider must be recorded as unavailable, never passed.

## Acceptance sequence

1. Regenerate Tideglass Sounding Line policy and the active case registry.
2. Validate policy, documentation, feature catalog, both Prisma schemas, and Phase 2 frozen contracts.
3. Run Tideglass diagnostics and the task-owned SQLite rehearsal.
4. Run source-bound subsystem/mainline gates with isolated Sounding Line resources.
5. Re-fetch `origin/main`, classify overlaps, reconcile shared generated sources, and repeat invalidated evidence.
6. Run exact-candidate Sounding Line and protected hosted checks.
7. If repository policy permits integration, validate the actual integrated main SHA and prove local/remote parity.

Phase 2 is not accepted on raw test success alone, and Phase 3 is not authorized by Phase 2 closure.
