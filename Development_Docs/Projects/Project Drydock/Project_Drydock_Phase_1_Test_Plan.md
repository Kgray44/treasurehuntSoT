---
title: Project Drydock Phase 1 Test Plan
audience: engineering
status: current
canonical_for: project-drydock-phase-1-test-plan
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 test plan

Sounding Line is the test authority. Phase 1 adds the Tier 1, read-only, parallel-safe `unit.drydock` family, owned by `drydock`, under the critical `drydock-authoring-contracts` contract. Resources are `node-slot` and `vitest-worker-pool`; expected duration is 30 seconds and the hard budget is 180 seconds. The family is required for local-change, subsystem, mainline, and release-candidate gates.

## Required families

| Family           | Proof                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry         | all 23 types; unique type/version; deterministic registry; unknown type and unsupported version separation                                                                          |
| Strict schemas   | representative valid input for every type; per-type wrong primitive and unknown-field mutations; enum/range/array/nested/reference/cross-field cases; extension policy; round trips |
| Variables        | all seven types; scopes/privacy/defaults; permitted and prohibited operations; duplicates; usage index; undeclared references; safe rename/no prose replacement                     |
| Expressions      | every node; compatible/incompatible types; deterministic and short-circuit evaluation; depth/node/size/finite limits; enum/set behavior; executable-shape rejection                 |
| Migrations       | ordered deterministic v1-to-v2 paths for all types; idempotency; exact missing path; preserved ID/prose; target preview; immutable fixture input                                    |
| Compatibility    | frozen synthetic v1 corpus; current v2 and mixed known compatibility fields; unsupported future version is not corruption                                                           |
| Current product  | existing validator, Studio autosave/preview/publish, publishing snapshots, provider dispatch, and One Voyage progression suites remain selected by mainline                         |
| Security/privacy | executable content, non-finite values, mass assignment, unknown extensions, cross-Chronicle targets, and diagnostic private metadata fail or redact                                 |
| Performance      | changed-block incremental path plus synthetic 230-block full sample; record actual observed duration and environment                                                                |

Browser work is not added solely for the contract layer. Sounding Line's existing mainline Studio, Player, Captain, access sentinel, database, build, and architecture coverage supplies product no-regression evidence where selected.
