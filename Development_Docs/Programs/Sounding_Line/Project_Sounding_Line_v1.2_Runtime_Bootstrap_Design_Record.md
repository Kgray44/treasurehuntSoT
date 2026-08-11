---
title: Project Sounding Line v1.2 Runtime Bootstrap Design Record
audience: engineering
status: active
canonical_for: sounding-line-v1.2-runtime-bootstrap-design
last_reviewed: 2026-08-11
---

# Project Sounding Line v1.2 Runtime Bootstrap Design Record

## Authority and candidate

This bounded infrastructure slice starts from `origin/main` at
`d5955c713ca26016e4160021c9b2dcd3aaf0f6c4`. It operationalizes the
Part I, Part II, and Part III v1.2 amendments through the existing Sounding
Line authority. The protected authority remains `Sounding Line / Mainline
Decision`; runtime conformance is evidence consumed by that decision, never a
second release authority.

The v1.2 amendment documents are incorporated into this candidate from their
dedicated governance commit. They become effective only if this candidate is
accepted through the protected mainline path.

## Observed implementation gap

The hosted governed-worker template currently performs Prisma generation,
SQLite migration, and seeding for every sealed node. It also installs both
Chromium and WebKit for a suite selected by the broad `browser.*` prefix. The
authoritative workflow derives serialization from a broad `parallelSafe` flag
and a three-wave matrix. These behaviors prepare resources that a selected
node may not declare and obscure setup cost.

## Frozen bootstrap scope

This slice will:

- add one canonical machine-readable effective-authority index and a generated
  or index-linked human-readable projection;
- add Sounding Line-owned runtime-conformance validation, classifications, and
  evidence binding inside the existing mainline decision;
- derive worker preparation and browser installs from a sealed plan node's
  declared resources and certified adapter requirements;
- remove universal database preparation while retaining database setup for
  nodes that declare it;
- emit machine-readable worker, workflow, and finalizer throughput timings;
- remove only clearly unjustified hosted serialization that isolated GitHub
  runners and declared resources prove independent; and
- add focused tests, governing documentation, and a canonical deferred-work
  backlog.

## Explicitly deferred v1.2 work

This bootstrap does not implement automatic Evidence Invalidation Manifest and
carry-forward execution, record-closure composition, certified reusable
SQLite baselines, multi-suite worker bundling, capacity bin packing, dynamic
ports, a dynamic DAG controller, or runner-infrastructure changes. Each
deferred capability will be recorded with its governing requirement,
correctness invariant, dependency/risk, benefit, and recommended next slice.

## Correctness constraints

No optimization may change required-suite selection, source/policy/inventory/
plan digest binding, receipt cardinality, cleanup enforcement, case counts,
privacy, authorization, accessibility, migration proof, or finalizer
semantics. Missing or mismatched resource/conformance evidence fails closed.
Database and browser preparation are eliminated only where both selected-node
resources and adapter requirements prove them unnecessary.

## Validation and integration

Focused conformance and workflow-policy tests will precede the exact-candidate
Sounding Line mainline authority. The candidate will be reconciled with current
`origin/main` immediately before authoritative proof and again before merge.
Acceptance requires the protected Mainline Decision and proof on the actual
integrated SHA. Paused feature projects will be notified only after that proof.
