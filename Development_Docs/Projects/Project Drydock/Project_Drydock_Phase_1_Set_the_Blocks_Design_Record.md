---
title: Project Drydock Phase 1 Set the Blocks Design Record
audience: engineering
status: current
canonical_for: project-drydock-phase-1-design
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1: Set the Blocks design record

This record freezes Phase 1 contracts before broad implementation. It describes the accepted repository at base `5b266251bd5a42efe90988e45daf55bca8e566f1`, not the historic SHA printed in the governing PDF.

## Current Story Block inventory and versions

The current registry contains 23 supported Passage types in `src/chronicle/block-registry.ts`; every persisted type currently reports schema version 1.

| Family                   | Current types                                                                 | Runtime / projection consumers                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Narrative and completion | `narrative`, `captainsNote`, `information`, `chapterComplete`, `taleComplete` | `src/chronicle/progression.ts`, `src/chronicle/journal-contract.ts`, `src/components/tales/PublishedBlockView.tsx` |
| Directions               | `travelDirection`, `location`, `arrivalCheck`                                 | Chronicle progression, journal projection, published renderer                                                      |
| Media                    | `image`, `imageTransformation`, `cinematic`, `audio`                          | journal projection, published renderer, presentation runtime                                                       |
| Reveals                  | `artifactReveal`, `hiddenMessageReveal`, `collectionUpdate`                   | One Voyage progression, artifact grant adapter, published renderer                                                 |
| Interactions             | `riddle`, `confirmation`, `choice`, `textAnswer`, `captainApproval`           | One Voyage completion/provider dispatch and journal projection                                                     |
| Logic                    | `wait`, `condition`, `setVariable`                                            | One Voyage automatic progression and runtime variable compatibility                                                |

Current persistence already separates `configuration`, `presentation`, and `completion` JSON columns, plus relational `BlockConnection` rows and legacy `nextBlockId`. Creator inspector fields are supplied by `block-registry.ts`; Studio reads and writes them in `TaleEditor.tsx`. Existing validation is in `src/chronicle/validation.ts`; publishing snapshots are built in `src/chronicle/publishing.ts`; current imports include Studio save, legacy migration, Sealed Hold package materialization, and canonical export paths.

The duplicated target representations are:

- `choice.configuration.choices[].targetBlockId` versus `BlockConnection` rows of type `CHOICE`;
- `condition.configuration.successTargetBlockId` / `failureTargetBlockId` versus `SUCCESS` / `FAILURE` rows;
- `StoryBlock.nextBlockId` versus the first/default relational edge.

`BlockConnection` is the canonical graph authority. Phase 1 retains read compatibility for the other forms, detects disagreement, and provides deterministic migration previews. It does not implement Phase 2 graph analysis.

## Drydock block contract and registry

`DrydockBlockContract` has a stable type ID, current version, minimum reader version, strict configuration/presentation/completion schemas, connection policy, typed asset requirements, variable reads and writes, provider reference, accessibility requirements, canonicalization policy, compatibility metadata, registered extensions, and ordered migration definitions.

- Current strict contract version: **2** for all 23 types.
- Minimum supported reader: **1**.
- Duplicate type/version pairs: forbidden.
- Lookup and serialized catalog ordering: registry order, then numeric version.
- Unknown block type: `UNSUPPORTED_BLOCK_TYPE`, never generic corruption.
- Unsupported past/future version: exact compatibility issue with the observed and supported versions.

## Unknown fields and extensions

Version-2 schemas are strict. Unknown root fields are rejected. Extensions may appear only in the `extensions` object and only under a registered, versioned namespace. Registered extension adapters own a strict payload schema and an activation state. Compatibility may preserve a specifically registered inactive extension; arbitrary generic bags are not accepted.

Known version-1 compatibility fields such as `futureVision` and `futureProviderOptions` are migrated only through registered adapters. They are not proof that arbitrary future fields are supported.

## Canonical parsing, defaults, and serialization

Parsing accepts the full authored transport (`type`, `schemaVersion`, `configuration`, `presentation`, `completion`, and connections), applies only an explicit ordered migration, then validates strict current schemas. Defaults are applied only for new Passage creation or an explicit migration. Invalid values are never repaired during publication.

Canonicalization sorts object keys recursively, preserves array order unless a field contract declares order-insensitive semantics, rejects non-finite numbers, preserves Creator prose byte-for-byte, and introduces no clock or random values. Canonical serialization uses deterministic JSON and must satisfy parse/serialize/parse stability.

Version-1 `configuration.completionMode` is a compatibility transport alias. The v1-to-v2 migration moves its semantic value into the strict `completion` contract while retaining a runtime compatibility projection until One Voyage adopts the separated field. Presentation and completion changes do not alter each other.

## Typed contract categories

- Configuration: authored content and behavior only.
- Presentation: strict journal/presentation options and scene references.
- Completion: provider/completion eligibility policy, fallbacks, retry and override references.
- Connections: relational edge authority plus bounded legacy target compatibility.
- Assets: field path, allowed media roles/types, requiredness, and fallback obligation.
- Providers: versioned provider registry reference; no provider simulation in Phase 1.
- Accessibility: required alt, transcript, captions/poster, reduced-motion meaning, and accessible provider fallback metadata where applicable.

## Variables

Variable catalog version 1 uses stable IDs independent of Creator-readable names. Core types are Boolean, Integer, Number, String, Enum, String Set, and Identifier Reference. Arbitrary JSON is forbidden. Supported scope is `CHRONICLE_DEFINITION` or `SESSION`; chapter/member scopes are rejected until canonical One Voyage semantics support them.

Each declaration records type, scope, default, description, operations, privacy class, enum/domain metadata, and catalog version. The usage index records declarations, reads, writes, operations, expressions, block/field paths, labels, privacy, and future scenario references. Rename operates by stable ID over known authored references only; it never performs prose replacement and never mutates immutable published snapshots.

## Expressions

Expression AST version 1 is a discriminated union of literal, variable, compare, logical, not, contains, and count nodes. It permits no code, arbitrary traversal, dynamic import, regex execution, network, time, or randomness.

Type checking is explicit. Logical nodes require Boolean values; numeric comparison requires compatible numeric types; enum comparison requires the same domain; contains requires String Set plus String; count returns Integer. Evaluation uses exact finite numbers, locale-independent string comparison, deterministic left-to-right short-circuiting, and declared variable defaults/state only.

Limits are frozen at depth 16, 128 total nodes, 16 logical operands per node, 128 set members, and 32 KiB canonical serialized size. The expression-builder metadata exposes valid variables, operators, literal editor types, enum members, grouping, safe summaries, and canonical trees without redesigning Studio.

## Schema migration and compatibility

Migration registry version 1 contains ordered per-type v1-to-v2 migrations. Each migration declares scope, source/destination, preconditions, transformation, warnings, data-loss state, checksum behavior, and fixture IDs. Published snapshots remain immutable and are upcast only in memory. Historical content becomes editable only through an explicit draft operation.

Frozen fixtures are clearly synthetic, version-pinned, and append-only. They cover every current type, generic configuration, variables/conditions, provider seams, and duplicated target fields. Unknown future versions are reported as unsupported, not corrupt.

## Stable issue model

A Drydock issue has a stable ID derived from rule code, rule version, semantic location, block ID, field path, variable ID, and compatibility state—not message text. Categories in Phase 1 are `SCHEMA`, `REFERENCE`, `VARIABLE_DECLARATION`, `VARIABLE_TYPE`, `EXPRESSION`, `MIGRATION`, `COMPATIBILITY`, `EXTENSION`, `ACCESSIBILITY_CONTRACT`, and `PROVIDER_CONTRACT`. Issues contain safe explanations/remediation and privacy-safe metadata; accepted answers and private prose never appear in machine output.

## Incremental validation

The Phase 1 dependency index maps blocks and fields to direct variable, expression, asset, provider, presentation/scene, edge, and migration dependencies. A changed block validates only its strict contract and direct dependencies. A changed variable invalidates its declarations and direct usage sites. Full transitive control-flow, reachability, loop, and state-flow analysis remains Phase 2.

## Existing integration and compatibility adapters

The schema-level portion of `validateTaleDraft` delegates to Drydock and maps Drydock issues back to the accepted `ValidationIssue` shape. Existing unknown-block, answer, asset, provider, broken-connection, choice/condition target, reachability, completion-path, and unused-asset behavior remains. Studio registry metadata continues to drive the current UI. Publishing parses through the same contract layer without changing One Voyage runtime semantics; import compatibility remains at the existing Studio transport and registry boundary in Phase 1.

Compatibility adapters remain for version-1 generic configuration, configuration-owned completion mode, configuration-owned choice/condition targets, and `nextBlockId`. They are explicit and test-bound, not parallel authorities.

## Phase boundary, concurrency, and schema declaration

Phase 2 owns whole-Chronicle graph/state analysis, the complete rule catalog, issue navigation, repairs, and waivers. Phase 3 owns simulation. Phase 4 owns full Studio/publishing integration and program closure.

The phase is `CLASS_B_COORDINATED`. Drydock owns authoring contract semantics; Shipwright owns Creator interaction and layout; One Voyage owns runtime progression and publication transactions. Direct overlap in the canonical Story Block contract becomes a serialized Class-C seam and must be reconciled before acceptance.

Prisma changes: **NO**. Migration reservation: **NONE**. The [Mainline Safety Contract](Project_Drydock_Phase_1_Mainline_Safety_Contract.md) is frozen and the permanent-stop answer is **YES**.
