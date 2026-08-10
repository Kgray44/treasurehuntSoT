---
title: Project Drydock Phase 1 Variable and Expression Contract Record
audience: engineering
status: current
canonical_for: project-drydock-phase-1-variable-expression-contract
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 variable and expression contract record

## Variable registry

Variable catalog version 1 is implemented in `src/drydock/variables.ts`. A declaration requires a stable ID, Creator-readable name, exact type, governed scope, optional compatible default, allowed operations, and privacy class.

Core types are Boolean, Integer, Number, String, Enum with a named domain and bounded unique members, String Set, and Identifier Reference with an entity type. Only `CHRONICLE_DEFINITION` and `SESSION` scopes are accepted. Drydock does not invent member-scoped runtime state or seize One Voyage runtime ownership.

Operations are type-gated: assignment/toggle for Boolean; assignment and bounded numeric mutation for Integer/Number; assignment/clear/compare for String; assignment/compare for Enum; add/remove/contains/count for String Set; and assignment/clear for Identifier Reference. Non-finite numbers, invalid enum members, oversized sets, incompatible operands, and undeclared references fail exactly.

The usage index records declaration, read, write, operation, expression, label, and future scenario use sites with block/field paths and privacy. Rename is stable-ID-driven and updates only governed condition/set-variable references. It never scans or rewrites prose and never rewrites immutable published content.

## Expression AST

Expression version 1 is a strict discriminated AST with literal, variable, compare, logical, not, contains, and count nodes. Type checking occurs before evaluation. Evaluation is deterministic, left-to-right, short-circuiting, finite-number-only, and has no `eval`, Function constructor, dynamic import, regular-expression execution, network, clock, or randomness access.

| Limit                     | Phase 1 value |
| ------------------------- | ------------: |
| Maximum depth             |            16 |
| Maximum nodes             |           128 |
| Logical operands per node |            16 |
| String Set members        |           128 |
| Canonical serialized size |        32 KiB |

Builder metadata exposes stable variable IDs/names/types/privacy, compatible operators, and these bounds for future Shipwright-owned visual authoring. Phase 1 does not add a polished expression editor.
