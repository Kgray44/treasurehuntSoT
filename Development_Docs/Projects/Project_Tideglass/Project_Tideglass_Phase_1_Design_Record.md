---
title: Project Tideglass Phase 1 Design Record
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-1-design
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 1 design record: Set the Glass

Status: frozen for implementation. Phase 1 creates an additive, read-only semantic comparison authority and a diagnostic seam. It does not create an ordinary user route, a polished comparison experience, release-note mutation, comparison persistence, or any Phase 2 behavior.

## Preflight and authority

| Item                      | Frozen value                                                              |
| ------------------------- | ------------------------------------------------------------------------- |
| Repository                | `Kgray44/treasurehuntSoT`                                                 |
| Dedicated worktree        | `C:\Users\kkids\Documents\treasurehuntSoT-tideglass-phase1-set-the-glass` |
| Branch                    | `codex/project-tideglass-phase1-set-the-glass`                            |
| Original `origin/main`    | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                |
| Initial worktree          | clean, tracking `origin/main`                                             |
| Semantic schema           | `tideglass.semantic.v1`                                                   |
| Comparison policy         | `tideglass.policy.v1`                                                     |
| Digest                    | SHA-256 over UTF-8 canonical JSON                                         |
| Persistence               | none                                                                      |
| Prisma / migration impact | none for SQLite and MySQL                                                 |

The governing order is the repository rules, global product governance, the Project Tideglass governing document, the Continuous Development and Mainline Integration Standard, current accepted One Voyage/Wayfarer/Harborlight/Sounding Line contracts, and current source. Drydock is not implemented on the accepted base. Tideglass therefore provides a narrow historical-reader interface, supports only the schemas it can normalize honestly, and does not create a competing migration framework.

## Existing authority survey

| Path                                                  | Existing role and authority                                                                                             | Tideglass disposition                                              | Noise or compatibility concern                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `prisma/schema.sqlite.prisma`, `prisma/schema.prisma` | Canonical Chronicle, immutable `PublishedTaleVersion`, live Voyage, Wayfarer history, and Community release persistence | Read through the existing client; never write                      | Both provider schemas must remain unchanged                                      |
| `src/chronicle/types.ts`                              | Current published snapshot shape, schema version 1                                                                      | Adapt through the Phase 1 reader                                   | Locations and artifacts are open records; unknown fields cannot be guessed       |
| `src/chronicle/publishing.ts`                         | Authoritative snapshot creation and exact stored-byte checksum                                                          | Reuse checksum rule and immutable rows                             | `publishedAt`, storage names, and object insertion order are not semantic        |
| `src/chronicle/block-registry.ts`                     | Accepted Story Block types and authored field definitions                                                               | Use as the source vocabulary for block semantics                   | Unknown future block fields make that section unavailable rather than inferred   |
| `src/chronicle/studio-authorization.ts`               | Canonical Creator workspace and Chronicle ownership authorization                                                       | Reuse its account/role ownership meaning in the repository adapter | Both editions require independent authorization                                  |
| `src/chronicle/studio-service.ts`                     | Existing Creator Studio raw version-history comparison                                                                  | Explicitly not Tideglass authority and unchanged in Phase 1        | Raw serialized field comparison is unsuitable as canonical semantic intelligence |
| `src/wayfarer/chronicle-history.ts`                   | Personal history projection pinned to exact edition identity                                                            | Not owned and never mutated                                        | History rows are invariance subjects only                                        |
| `src/community/release-updates.ts`                    | Harborlight release/update lineage over immutable editions                                                              | Not owned and never mutated                                        | Community releases are invariance subjects only                                  |
| `scripts/sounding-line`, `testing`                    | Sole governed test planning and acceptance authority                                                                    | Register Tideglass owner, contracts, paths, and suite              | Raw test commands remain diagnostic only                                         |

## Mainline Safety Contract

1. The phase is additive under `src/tideglass`, `scripts/tideglass`, tests, testing policy, and engineering records.
2. Existing publication, Studio comparison, Voyage execution, Wayfarer history, Harborlight release, routes, and navigation remain behaviorally unchanged.
3. Tideglass reads two exact immutable editions and returns an in-memory result. It performs no mutation and has no business table, cache, outbox, or durable receipt.
4. No unfinished route or UI is introduced. The diagnostic CLI requires a trusted local account identifier and emits only a safe diagnostic projection.
5. Removing the Tideglass module and its registrations restores the prior application without data repair.
6. Phase 2 is not needed to keep accepted main coherent.

## Module boundaries

- `core`: strict contracts, policy registries, canonical JSON, identifiers, digests, safe failures.
- `semantic`: current-schema/historical-reader registry and domain-specific canonical semantic snapshots.
- `matching`: exact stable-ID, explicit replacement, unmatched, and ambiguous outcomes. It never uses fuzzy text matching.
- `comparison`: purpose-built metadata, ordered structure, block-field, graph, artifact, world, media, accessibility, and requirement comparison.
- `projection`: authorized diagnostic and conservative public-safe foundation DTOs; neither contains raw snapshots or raw semantic values.
- `service`: exact resolution, independent authorization, checksum verification, limits, canonicalization, comparison, receipt, and operational metrics.
- `repository`: the existing Prisma client and Creator ownership meaning behind a read-only port.
- `scripts/tideglass/compare.ts`: trusted local diagnostic caller. It contains no comparison logic.

## Frozen contracts

`ResolvedEditionAnchor` contains Chronicle ID, edition ID, stored checksum, publication time when available, source schema version, and retained state. `EditionPair` contains one Chronicle ID and source/target anchors; all three Chronicle IDs must match. Floating aliases are not accepted or retained.

`ChronicleSemanticSnapshot` contains the exact edition anchor, semantic schema version, metadata, ordered chapters and blocks, graph, progression facts, artifacts, world locations, media, accessibility facts, requirement facts, and explicit unsupported sections. Missing future concepts remain absent or unsupported; they are never fabricated.

The version-1 historical reader strictly requires the accepted top-level edition shape and typed structural identities. It normalizes known optional/default values, accepted enum aliases, set-like collections, timestamps, filenames, object ordering, and storage paths. Ordered chapters, blocks, choices, and graph connections retain order. Media uses published asset/variant stable identity and any available content checksum; current snapshots do not claim byte-level media identity when none was published. Unknown schema versions retain only safe edition identity and report semantic sections unavailable.

## Identity, replacement, and ambiguity

Chapters, blocks, artifacts, locations, media, graph nodes, and graph edges use published stable semantic IDs. Same stable ID yields `EXACT_STABLE_ID`; absent source/target IDs yield removal/addition. Explicit replacement is accepted only through the comparison-unit replacement map and yields `REPLACED`; there is no business-schema replacement field in Phase 1. Duplicate IDs yield `AMBIGUOUS`, make the affected section unavailable, and never select the first item. Equal prose under different IDs remains remove/add.

## Change records and ordering

Atomic kinds are `ADDED`, `REMOVED`, `MODIFIED`, `MOVED`, `REWIRED`, and `REPLACED`. Categories are the governed fourteen-category taxonomy. Significance and spoiler enums are frozen in the TypeScript contract. Evidence retains exact edition IDs/checksums, stable entity IDs, semantic path, semantic value digests, comparator ID, and both policy versions; it never retains raw narrative, answers, coordinates, storage keys, or private notes.

Record ID is SHA-256 of canonical comparison identity, category, kind, entity type, source/target identity, and semantic path. Records sort by semantic structural order, category registry order, entity type, stable entity identity, kind registry order, and path. Unsupported sections sort by section and code. Category counts follow category-registry order.

## Comparison identity, Change Set, and receipt

Comparison ID is SHA-256 over canonical JSON containing `sourceEditionChecksum`, `targetEditionChecksum`, `semanticSchemaVersion`, and `comparisonPolicyVersion`. Direction therefore changes identity. Change Set digest is SHA-256 over the canonical deterministic Change Set excluding its own digest and every operational field. Identical semantics returns `NO_MEANINGFUL_CHANGE` with an empty record list and a complete identity/receipt. Unsupported sections produce `PARTIAL`; otherwise semantic changes produce `COMPLETE`.

The machine-readable receipt binds the exact pair, source and target schema versions, normalization adapters, status, counts, unsupported sections, and deterministic digest. A separate operational envelope may contain duration and correlation ID; these never affect comparison ID, record IDs, ordering, or digest.

## Graph rules

Graph nodes are stable blocks. Node add/remove is structural. A stable edge key is source block, connection type, label, condition, and order. A target change with the same stable edge key is `REWIRED`; unmatched edges are added/removed. Entry/completion block changes are graph/ending facts. Editor coordinates are discarded. Terminal `taleComplete` additions are ending changes.

## Authorization and failure model

The service accepts a server-derived principal, resolves the Chronicle and both exact edition IDs without exposing nearby rows, authorizes source and target independently under Creator/admin/collaborator ownership, then verifies the SHA-256 checksum of each exact stored snapshot string. Client-supplied audience or Creator mode is not accepted. The CLI trust boundary is an explicit local account ID; it cannot select a broader projection.

Failures are a discriminated union including `EDITION_NOT_FOUND`, `EDITION_NOT_AUTHORIZED`, `CROSS_CHRONICLE_COMPARISON`, `CHECKSUM_MISMATCH`, `PUBLISHED_SNAPSHOT_INVALID`, `SEMANTIC_SCHEMA_UNSUPPORTED`, `SEMANTIC_SECTION_UNAVAILABLE`, `ENTITY_IDENTITY_AMBIGUOUS`, `NORMALIZATION_FAILED`, `COMPARISON_FAILED`, `COMPARISON_CANCELLED`, and `COMPARISON_LIMIT_EXCEEDED`. Safe messages and optional correlation IDs exclude payload content and enumeration detail.

## Limits, telemetry, and redaction

Phase 1 bounds snapshot bytes, chapters, blocks, edges, media, artifacts, and locations before comparison. Stable-ID maps keep matching linear. Operational logging may include identities, checksums, versions, status, counts, unsupported-section codes, timings, failure code, and correlation ID. It excludes raw snapshots, story text, answers, notes, participant data, cookies, tokens, storage keys, and private URLs. The CLI prints a safe projection only.

## Sounding Line and test ownership

Project Tideglass owns `src/tideglass/**`, `scripts/tideglass/**`, `tests/tideglass/**`, and these project records. Its registered contracts cover exact immutable edition identity, semantic normalization/determinism, safe projections, authorization, and read-only invariance. Pure contracts and comparison run at the lowest unit tier; no browser is required. Sounding Line remains the acceptance authority.

## Phase 2 handoff

Later phases may consume the stable comparison service, Change Set, receipt, and safe projection primitives. They may add audience-specific human intelligence and user surfaces only under their own accepted phase. They must not bypass exact anchors, server authorization, deterministic policy binding, or redaction.
