---
title: Project Trim Phase 2 Architecture and Implementation Record
audience: engineering
status: current
canonical_for: project-trim-phase-2-architecture
last_reviewed: 2026-08-18
---

# Project Trim Phase 2 - Pack the Chart

## Governing boundary

Phase 2 implements the `Pack the Chart` plateau in the Project Trim v1.0-R1 governing baseline. Project Trim controls agent context only. Current repository source and governing documents remain authoritative for their owned behavior, and Sounding Line remains the sole verification, `RELEASE_GO`, and protected-merge authority. The packet cannot expand product scope, authorize a merge, or replace exact authority text.

At the accepted Phase 2 closure, Phase 3 had not begun. Accepted Phase Capsules, persistent read/search-ledger optimization, and subagent context slicing were excluded from this Phase 2 increment.

## Packet contract

The production packet schema is `2.0`; generator identity is `project-trim-mscp-2.0.0`. The executable entry point remains `scripts/agent-context/build-context.mjs`; Phase 2 implementation is in `scripts/agent-context/packet-v2.mjs`, with the explicit JSON contract at `scripts/agent-context/packet-v2.schema.json`. Phase 1 public exports and ledger/usage helpers remain compatible.

Every packet contains:

- task, source, worktree, dirty-state, scope, completion, and locally attainable boundary identity;
- authority slices with path/version, Git/SHA-256 source identity, requirement or section IDs, ownership domain, normative summary, relevance, precedence, exact-text escalation, confidence, and staleness triggers;
- prior-plateau, ownership/consumer/seam, source, schema/data, verification, dependency, and bounded current-main delta slices;
- visible mapping provenance and `EXACT`, `BOUNDED`, `COARSE`, or `UNKNOWN` confidence;
- explicit conservative expansion actions for unmapped paths and unresolved accepted-main changes;
- per-section source and content digests plus one semantic packet digest;
- canonical JSON and a compact task-facing Markdown projection from the same packet truth.

Object-key normalization is deterministic. Git blob identity is calculated from exact working-tree bytes, SHA-256 covers the same bytes, and commit/tree identities bind current source. Observation time, dirty worktree state, and worktree path are explicit dynamic fields; observation and task-local ledger material do not silently alter semantic identity.

## Slice derivation

Phase 2 composes the existing `testing/ownership.json`, `testing/impact-map.json`, `testing/contracts.json`, `testing/suites.json`, `testing/resources.json`, `testing/validation-debt.json`, `testing/sounding-line-authority.json`, document index, package manifests, Prisma sources, and Git identities. It adds no competing product, ownership, test, dependency, or release registry.

Ownership matching chooses the most specific canonical path pattern for each selected path. This prevents a broad platform pattern such as `scripts/**` from flooding a more specific Project Trim closure. Verification selection retains current Sounding Line required sentinels. The bounded dependency scan records direct JavaScript/TypeScript package imports, manifest/lock identities, governed suite dependencies, and resource contracts. Prisma model selection is limited to explicit task models or bounded detected source usage; a schema pointer does not justify embedding every model.

The current-main delta records base/current commit and tree identities, changed paths by semantic class and canonical owner, authority/schema/dependency/test changes, source and accepted-assumption intersections, and unmapped accepted changes. It informs context only and never performs or authorizes Git reconciliation.

## Staleness and targeted regeneration

Packet states are `FRESH`, `PARTIALLY_STALE`, `STALE`, `CONFLICTED`, and `UNKNOWN`. Each reusable section has its own source binding. Authority, mapped source, schema/migration, suite/contract/resource, manifest/lock, profile, generator/schema, prior plateau, and current-main movement invalidate their affected slices independently.

`build-context.mjs --previous-packet <packet> --slices authority,sourceSlice` performs targeted regeneration. If no slice is requested, the CLI inspects the previous packet and refreshes only affected slices; a fresh packet is a no-op. Conflicted authority remains conflicted until exact-source precedence is resolved.

## Conservative fallback and privacy

Unknown paths are never omitted for size. The packet records each exact unmapped path, lowers confidence, identifies the affected slice, and supplies the next targeted ownership/impact/contract search. Known mappings remain bounded; directory membership alone does not create semantic trust.

Sensitive input keys and recognized credential forms are redacted. Packets retain safe identifiers and source pointers, not secrets, credentials, full prompts, raw private user content, or raw logs. Task-local packet output remains under ignored `.agent-context/`.

## Performance and benchmark

The generator reads canonical registries once per packet and caches stable Git queries within the process. It does not parse the repository, governing PDF library, or complete Git history. The Phase 2 benchmark record compares the accepted Phase 1 builder and Phase 2 builder on focused repair, product implementation, infrastructure, and release closure contracts.

Phase 2 Markdown measured 2,952-3,789 bytes (738-948 coarse estimated tokens). It retained the same one or two initial implementation pointers as Phase 1 while replacing three or four of five structurally missing startup closures with source-bound packet data. Whole-project searches avoided and end-to-end token savings remain `UNAVAILABLE` because no comparable live task replay was performed. No total task-token savings claim is made.

## Current limitations and Phase 3 handoff

- Authority documents without structured requirement metadata may require explicit task-provided section IDs or exact-text expansion; the document index alone does not invent normative sections.
- Dependency discovery is a bounded direct-import scan and does not claim a complete transitive build graph.
- Unmapped current-main paths remain visible and can require one targeted expansion.
- Warm generation on the measured UNC-backed repository was about 3.0-3.7 seconds; first source snapshot time and agent reading time are outside that warm measurement.
- Accepted Phase Capsules, durable search/read reuse, and subagent workstream packets remain Phase 3 work and must not be inferred from the Phase 2 ledger template.
